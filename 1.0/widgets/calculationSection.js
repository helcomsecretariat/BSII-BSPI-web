define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo",
	"dojo/on",
	"dojo/dom",
	"dojo/dom-style",
	"dojo/_base/array", "dojo/dom-construct",
	"dojo/data/ItemFileWriteStore", "dojox/grid/EnhancedGrid", "dijit/Tooltip",
	"dojox/form/CheckedMultiSelect", "dojo/data/ItemFileReadStore",
	"dijit/TitlePane", "dijit/form/CheckBox",
	"esri/tasks/Geoprocessor", "esri/layers/ImageParameters", "esri/dijit/Legend",
	"esri/tasks/IdentifyTask", "esri/tasks/IdentifyParameters", "esri/dijit/LayerSwipe",
	"app/js/utils"
], function(
	declare,
	lang,
	dojo,
	on,
	dom,
	domStyle,
	array, domConstruct,
	ItemFileWriteStore, EnhancedGrid, Tooltip,
	CheckedMultiSelect, ItemFileReadStore,
	TitlePane, CheckBox,
	Geoprocessor, ImageParameters, Legend,
	IdentifyTask, IdentifyParameters, LayerSwipe,
	utils
){
	return declare(null, {
		utils: null,
		selectedLayers: {
			"EC" : [],
			"PL": []
		},
		layerNames: null,
		calculateBSIIService: null,
		calculateBSPIService: null,
		calculationMapServer: null,
		bsiiLayer: null,
		bspiLayer: null,
		grid: null,
		sensitivityScores: null,
		sensitivityScoresStore: null,
		ecLayersForTooltip: {},
		plLayersForTooltip: {},
		map: null,
		bsiiCalculated: false,
		bspiCalculated: false,
		bsiiIdentify: null,
		bspiIdentify: null,
		swipeWidget: null,
		swipeWidgetStarted: false,
		swiping: false,
		bsiiDownloadLink: null,
		bspiDownloadLink: null,
		csvDownloadLink: null,

		constructor: function(params) {
			this.layerNames = params.layerNames;
			this.calculateBSIIService = params.services.calculateBSIIService;
			this.calculateBSPIService = params.services.calculateBSPIService;
			this.calculationMapServer = params.services.calculationMapServer;
			this.map = params.map;
			this.utils = new utils();
			this.postCreate();
		},

		postCreate: function() {

			var idp = new IdentifyParameters();
			idp.tolerance = 6;
			idp.returnGeometry = true;
			idp.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;
			idp.layerIds = [0];

			this.bsiiIdentify = {
				"task": null,
				"params": idp
			};
			this.bspiIdentify = {
				"task": null,
				"params": idp
			};

			//document.getElementById("loadingCover").style.display = "block";
			this.getLayers();

			on(dojo.byId("bsiiModeButton"), "click", lang.hitch(this, function() {
				this.clean();
				document.getElementById("bsiiModeMessages").style.display = "block";
				document.getElementById("ecGroupSection").style.display = "inline-block";
				document.getElementById("plGroupSection").style.display = "inline-block";
				document.getElementById("getLayersForGridButton").style.display = "inline-block";
			}));

			on(dojo.byId("bspiModeButton"), "click", lang.hitch(this, function() {
				this.clean();
				document.getElementById("bspiModeMessages").style.display = "block";
				document.getElementById("plGroupSection").style.display = "block";
				document.getElementById("calculateBspiButton").style.display = "inline-block";
			}));

			on(dojo.byId("getLayersForGridButton"), "click", lang.hitch(this, function() {
				document.getElementById("layersSelectionError").style.display = "none";
				if (this.grid == null) {
					if ((this.selectedLayers.EC.length > 1) && (this.selectedLayers.PL.length > 1)) {
						this.createSSGrid();
					}
					else {
						document.getElementById("layersSelectionError").style.display = "block";
					}
				}
			}));

			on(dojo.byId("resetSensitivityScores"), "click", lang.hitch(this, function() {
				this.resetSensitivityScores();
			}));

			on(dojo.byId("calculateBsiiButton"), "click", lang.hitch(this, function() {
				document.getElementById("loadingCover").style.display = "block";

				if (this.bsiiLayer != null) {
					this.removeBSIILayer();
				}

				var obj = {};
				array.forEach(this.sensitivityScores.items, lang.hitch(this, function(row) {
					var key = row["EC_CODE"][0];
					var values = {};
					for (var property in row) {
  					if (row.hasOwnProperty(property)) {
							if (property.startsWith("PL_")) {
								values[property] = row[property][0];
							}
  					}
					}
					obj[key] = values;
				}));
				document.getElementById("calculateMessage").style.display = "block";
				this.calculateBSII(JSON.stringify(obj));
			}));

			on(dojo.byId("calculateBspiButton"), "click", lang.hitch(this, function() {
				document.getElementById("plLayersSelectionError").style.display = "none";
				if (this.selectedLayers.PL.length > 1) {
					document.getElementById("loadingCover").style.display = "block";
					if (this.bspiLayer != null) {
						this.removeBSPILayer();
					}
					document.getElementById("calculateMessage").style.display = "block";
					this.calculateBSPI(JSON.stringify(this.selectedLayers.PL));
				}
				else {
					document.getElementById("plLayersSelectionError").style.display = "block";
				}
			}));
		},

		clean: function() {
			if (this.grid != null) {
				this.grid.destroy();
				this.grid = null;
			}

			document.getElementById("bsiiModeMessages").style.display = "none";
			document.getElementById("ecGroupSection").style.display = "none";
			document.getElementById("plGroupSection").style.display = "none";
			document.getElementById("getLayersForGridButton").style.display = "none";
			document.getElementById("bspiModeMessages").style.display = "none";
			document.getElementById("calculateBspiButton").style.display = "none";
			document.getElementById("layersSelectionError").style.display = "none";
			document.getElementById("plLayersSelectionError").style.display = "none";
			document.getElementById("resetSensitivityScores").style.display = "none";
			document.getElementById("ssMessage").style.display = "none";
			document.getElementById("calculateBsiiButton").style.display = "none";
		},

		resetSensitivityScores: function() {
			if (this.grid != null) {
				this.grid.destroy();
				this.grid = null;
			}

			document.getElementById("calculateBspiButton").style.display = "none";
			document.getElementById("layersSelectionError").style.display = "none";
			document.getElementById("resetSensitivityScores").style.display = "none";
			document.getElementById("ssMessage").style.display = "none";
			document.getElementById("calculateBsiiButton").style.display = "none";
		},

		getLayers: function() {
			var ecLayers = [], plLayers = [];
			for (i=0, len = this.layerNames.ecKeys.length; i < len; ++i) {
				ecLayers.push({"value": this.layerNames.ecKeys[i], "label": this.layerNames.ecKeys[i] + ": " + this.layerNames.ecLabels[i]});
				this.ecLayersForTooltip[this.layerNames.ecKeys[i]] = this.layerNames.ecLabels[i];
			}
			for (i=0, len = this.layerNames.plKeys.length; i < len; ++i) {
				plLayers.push({"value": this.layerNames.plKeys[i], "label": this.layerNames.plKeys[i] + ": " + this.layerNames.plLabels[i]});
				this.plLayersForTooltip[this.layerNames.plKeys[i]] = this.layerNames.plLabels[i];
			}
			this.setupSelectionContainer("EC", ecLayers);
			this.setupSelectionContainer("PL", plLayers);
		},

		setupSelectionContainer: function(type, layers) {
			var title = null, container = null;
			if (type == "EC") {
				title = "Ecosystem component layers";
				container = "ecGroupSection";
			}
			else if (type == "PL") {
				title = "Pressure layers";
				container = "plGroupSection";
			}

			var tp = new TitlePane({title: title});
			tp.placeAt(dojo.byId(container));
    	tp.startup();

			var layersStore = new ItemFileReadStore({
				data: {
					identifier: "value",
					label: "label",
					items: layers
				}
			});

			var multiSel = new CheckedMultiSelect ({
				dropDown: false,
				multiple: true,
				store: layersStore,
				style : {width: "100%"},
				onChange: lang.hitch(this, function() {
					this.selectedLayers[type] = multiSel.get("value");
				})
			}, tp.containerNode);

			var selAllButton = domConstruct.create("div", {class: "leftPanelLink", innerHTML: "Select all"}, dojo.byId(container), "last");
			selAllButton.sel = false;

			on(selAllButton, "click", lang.hitch(this, function() {
				if (selAllButton.sel) {
					multiSel.set("value", []);
					multiSel._updateSelection();
					selAllButton.innerHTML = "Select all";
					selAllButton.sel = false;
				}
				else {
					var options = multiSel.getOptions();
					multiSel.set("value", options);
					multiSel._updateSelection();
					selAllButton.innerHTML = "Unselect all";
					selAllButton.sel = true;
				}
			}));
		},

		createSSGrid: function() {
			document.getElementById("loadingCover").style.display = "block";
			var layout = [
				{
					noscroll: true,
					defaultCell: { width: "36px" },
					cells: [
						{field: "EC_CODE", name: "CODE", classes: "firstCol"}
          ]
				},
				{
					defaultCell: { width: "36px" },
					cells: []
				}
			];

			array.forEach(this.selectedLayers.PL, lang.hitch(this, function(pl) {
				layout[1].cells.push({field: pl, name: pl, editable: true});
			}));

			function headerRowsStyle(row) {
				if ((row.index == 0) || (row.index == 1)) {
					row.customStyles += "font-weight: bold;";
				}
				//this.grid.focus.styleRow(row);
				//this.grid.edit.styleRow(row);
		 	}

			this.grid = new EnhancedGrid({
        id: "gridContent",
        structure: layout,
				autoHeight: true/*,
				onStyleRow: headerRowsStyle
				selectable: true,
        plugins: {
					filter: {
						closeFilterbarButton: false,
						ruleCount: 3,
						itemsName: "target_species"
					}
				}*/
    	});
			this.grid.canSort = function(){return false};
    	this.grid.placeAt(dojo.byId("gridContainer"));
    	this.grid.startup();

			new Tooltip({
				connectId: this.grid.domNode,
				selector: ".firstCol",
				getContent: lang.hitch(this, function(matchedNode) {
				    return this.ecLayersForTooltip[matchedNode.innerText]
				})
      });

			new Tooltip({
				connectId: this.grid.domNode,
				selector: "th",
				getContent: lang.hitch(this, function(matchedNode) {
				    return this.plLayersForTooltip[matchedNode.innerText]
				})
      });

			this.sensitivityScores = {
	    	identifier: 'id',
	    	label: 'id',
	    	items: []
			};

			//document.getElementById("loadingCover").style.display = "block";
			fetch(windowUrl + appVersion + "/config/sscores.json")
				.then(lang.hitch(this, function(response) {
					return response.json();
				}))
				.then(lang.hitch(this, function(data) {
					for (i=0, len = data.length; i < len; ++i) {
						if (this.selectedLayers.EC.includes(data[i % len]["EC_CODE"])) {
							var obj = {
								"id": i + 1,
								"EC_CODE": data[i % len]["EC_CODE"]
							};
							for (var property in data[i % len]) {
				    		if (data[i % len].hasOwnProperty(property)) {
									if (this.selectedLayers.PL.includes(property)) {
										obj[property] = data[i % len][property];
									}
				    		}
							}
							this.sensitivityScores.items.push(obj);
						}
					}
					this.sensitivityScoresStore = new ItemFileWriteStore({data: this.sensitivityScores});
					this.grid.setStore(this.sensitivityScoresStore);
					document.getElementById("resetSensitivityScores").style.display = "inline";
					document.getElementById("ssMessage").style.display = "block";
					document.getElementById("calculateBsiiButton").style.display = "inline-block";
					document.getElementById("loadingCover").style.display = "none";
				}))
				.catch(lang.hitch(this, function(error) {
					document.getElementById("loadingCover").style.display = "none";
					console.log(error);
					alert("Unable to get sensitivity scores data. Try to reload page. Contact administrator at data@helcom.fi if alert appears again.");
				}));
		},

		createSwiper: function(layer) {
			this.swipeWidget = new LayerSwipe({
				type: "vertical",
				left: document.getElementById("map").clientWidth / 2,
				map: this.map,
				layers: [layer],
			}, "swipeDiv");
			this.swipeWidget.startup();
			this.swipeWidgetStarted = true;

			var swipeSwitcher = domConstruct.create("div", {}, swipeLayerDiv, "last");
			var swipeCheckbox = new CheckBox({checked: true});
			this.swiping = true;
			swipeCheckbox.placeAt(swipeSwitcher, "first");
			on(swipeCheckbox, "change", lang.hitch(this, function(checked) {
				if (checked) {
					this.swiping = true;
					this.setSwipeLayer();
				}
				else {
					this.swiping = false;
					this.swipeWidget.disable();
				}
			}));
			domConstruct.create("span", {"innerHTML": "Swipe top layer"}, swipeSwitcher, "last");
		},
		setSwipeLayer: function() {
			if (this.swiping) {
				var layerIds = this.map.layerIds;
				var topPos = layerIds.length-1;
				var swipeLayer = null;
				var layer = this.map.getLayer(layerIds[topPos]);
				if (!layer.visible) {
					layer = this.map.getLayer(layerIds[topPos-1]);
					if ((layer.visible) && (layer.name)) {
						if ((layer.name == "BSII") || (layer.name == "BSPI")) {
							swipeLayer = layer;
						}
					}
				}
				else {
					if (layer.name) {
						if ((layer.name == "BSII") || (layer.name == "BSPI")) {
							swipeLayer = layer;
						}
					}
				}

				if (swipeLayer != null) {
					this.swipeWidget.disable();
					this.swipeWidget.layers = [swipeLayer];
					this.swipeWidget.enable();
				}
				else {
					this.swipeWidget.disable();
					this.swipeWidget.layers = [];
				}
			}
		},

		calculateBSII: function(s) {
			var gp = new Geoprocessor(this.calculateBSIIService);
			console.log(s);
			var params = {"Input": s};
			gp.submitJob(params, gpJobComplete, gpJobStatus, gpJobFailed);
			var that = this;

			function gpJobComplete(jobinfo) {
				if (jobinfo.jobStatus == "esriJobSucceeded") {
					var imageParams = new ImageParameters();
					imageParams.imageSpatialReference = this.map.spatialReference;
					gp.getResultImageLayer(jobinfo.jobId, "Raster", imageParams, function(layer) {
						layer.name = "BSII";
						that.bsiiLayer = layer;
						that.bsiiCalculated = true;
		        that.map.addLayers([layer]);

						if (!that.swipeWidgetStarted) {
							that.createSwiper(layer);
						}
						else {
							that.setSwipeLayer();
						}
		      });

					gp.getResultData(jobinfo.jobId, "RasterDownload", function(data) {
						that.bsiiDownloadLink = data.value.url;
		      });

					gp.getResultData(jobinfo.jobId, "CsvFile", function(csv) {
						that.csvDownloadLink = csv.value.url;
		      });

					that.bsiiIdentify.task = new IdentifyTask(that.calculationMapServer+"/jobs/"+jobinfo.jobId);
					fetch(that.calculationMapServer+"/jobs/"+jobinfo.jobId+"/legend?f=pjson")
						.then(lang.hitch(this, function(response) {
							return response.json();
						}))
						.then(lang.hitch(this, function(data) {
							that.bsiiLegend(data);
						}))
						.catch(lang.hitch(this, function(error) {
							document.getElementById("loadingCover").style.display = "none";
							console.log(error);
							alert("Unable to get BSII legend. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
						}));
				}
				else {
					alert("Unable to calculate BSII raster. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
				}
				document.getElementById("calculateMessage").style.display = "none";
				document.getElementById("loadingCover").style.display = "none";
			}

			function gpJobStatus(jobinfo) {
				switch (jobinfo.jobStatus) {
	        case 'esriJobSubmitted':
	          console.log(jobinfo.jobStatus);
	          break;
	        case 'esriJobExecuting':
	          console.log(jobinfo.jobStatus);
	          break;
	        case 'esriJobSucceeded':
	          console.log(jobinfo.jobStatus);
	          break;
	      }
			}

			function gpJobFailed(error) {
				document.getElementById("calculateMessage").style.display = "none";
				document.getElementById("loadingCover").style.display = "none";
				console.log("gpJobFailed", error);
			}
		},

		calculateBSPI: function(s) {
			var gp = new Geoprocessor(this.calculateBSPIService);
			console.log(s);
			var params = {"Input": s};
			gp.submitJob(params, gpJobComplete, gpJobStatus, gpJobFailed);
			var that = this;

			function gpJobComplete(jobinfo) {
				if (jobinfo.jobStatus == "esriJobSucceeded") {
					var imageParams = new ImageParameters();
					imageParams.imageSpatialReference = this.map.spatialReference;
					gp.getResultImageLayer(jobinfo.jobId, "Raster", imageParams, function(layer) {
						layer.name = "BSPI";
						that.bspiLayer = layer;
						that.bspiCalculated = true;
		        that.map.addLayers([layer]);

						if (!that.swipeWidgetStarted) {
							that.createSwiper(layer);
						}
						else {
							that.setSwipeLayer();
						}
		      });

					gp.getResultData(jobinfo.jobId, "RasterDownload", function(data) {
						that.bspiDownloadLink = data.value.url;
		      });

					that.bspiIdentify.task = new IdentifyTask(that.calculationMapServer+"/jobs/"+jobinfo.jobId);
					fetch(that.calculationMapServer+"/jobs/"+jobinfo.jobId+"/legend?f=pjson")
						.then(lang.hitch(this, function(response) {
							return response.json();
						}))
						.then(lang.hitch(this, function(data) {
							that.bspiLegend(data);
						}))
						.catch(lang.hitch(this, function(error) {
							document.getElementById("loadingCover").style.display = "none";
							console.log(error);
							alert("Unable to get BSPI legend. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
						}));
				}
				else {
					console.log(jobinfo);
					alert("Unable to calculate BSPI raster. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
				}
				document.getElementById("calculateMessage").style.display = "none";
				document.getElementById("loadingCover").style.display = "none";
			}

			function gpJobStatus(jobinfo) {
				switch (jobinfo.jobStatus) {
	        case 'esriJobSubmitted':
	          console.log(jobinfo.jobStatus);
	          break;
	        case 'esriJobExecuting':
	          console.log(jobinfo.jobStatus);
	          break;
	        case 'esriJobSucceeded':
	          console.log(jobinfo.jobStatus);
	          break;
	      }
			}

			function gpJobFailed(error) {
				document.getElementById("calculateMessage").style.display = "none";
				document.getElementById("loadingCover").style.display = "none";
				console.log("gpJobFailed", error);
			}
		},

		bsiiLegend(data) {
			var bsiiLegendDiv = dojo.byId("bsiiLegendDiv");
			domConstruct.create("div", { style: "font-size: 16px;", "innerHTML": "BSII layer" }, bsiiLegendDiv, "last");
			if (data.layers) {
				array.forEach(data.layers[0].legend, lang.hitch(this, function(lI) {
					var legendRow = domConstruct.create("div", { "class": "legendRow" }, bsiiLegendDiv, "last");

					legendRow.innerHTML = lI.label;
					var legendRowStyle = {
						"background-image": 'url("data:image/png;base64,'+lI.imageData+'")',
						"line-height": lI.height+"px",
						"padding-left": lI.width+5+"px"
					};
					domStyle.set(legendRow, legendRowStyle);
				}));
			}

			var layerSwitcher = domConstruct.create("div", {}, bsiiLegendDiv, "last");
			var layerCheckbox = new CheckBox({checked: true});
			layerCheckbox.placeAt(layerSwitcher, "first");
			on(layerCheckbox, "change", lang.hitch(this, function(checked) {
				if (checked) {
					this.bsiiLayer.setVisibility(true);
				}
				else {
					this.bsiiLayer.setVisibility(false);
				}
				this.setSwipeLayer();
			}));
			domConstruct.create("span", {"innerHTML": "Show BSII layer"}, layerSwitcher, "last");

			var bsiiTopButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Show BSII layer on top"}, bsiiLegendDiv, "last");
			var bsiiDownloadButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Download BSII layer"}, bsiiLegendDiv, "last");
			var csvDownloadButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Download BSII statistics"}, bsiiLegendDiv, "last");
			var bsiiRemoveButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px; color: #E61D2B", innerHTML: "Remove BSII layer"}, bsiiLegendDiv, "last");

			on(bsiiTopButton, "click", lang.hitch(this, function() {
				if (this.bsiiLayer != null) {
					var topPos = this.map.layerIds.length-1;
					this.map.reorderLayer(this.bsiiLayer, topPos);
					this.setSwipeLayer();
				}
			}));

			on(bsiiDownloadButton, "click", lang.hitch(this, function() {
				if (this.bsiiLayer != null) {
					window.location = this.bsiiDownloadLink;
				}
			}));

			on(csvDownloadButton, "click", lang.hitch(this, function() {
				if (this.bsiiLayer != null) {
					window.location = this.csvDownloadLink;
				}
			}));

			on(bsiiRemoveButton, "click", lang.hitch(this, function() {
				if (this.bsiiLayer != null) {
					this.removeBSIILayer();
				}
			}));

			document.getElementById("bsiiLegendDiv").style.display = "block";
			document.getElementById("legendDiv").style.display = "block";
		},

		bspiLegend(data) {
			var bspiLegendDiv = dojo.byId("bspiLegendDiv");
			domConstruct.create("div", { style: "font-size: 16px;", "innerHTML": "BSPI layer" }, bspiLegendDiv, "last");
			if (data.layers) {
				array.forEach(data.layers[0].legend, lang.hitch(this, function(lI) {
					var legendRow = domConstruct.create("div", { "class": "legendRow" }, bspiLegendDiv, "last");

					legendRow.innerHTML = lI.label;
					var legendRowStyle = {
						"background-image": 'url("data:image/png;base64,'+lI.imageData+'")',
						"line-height": lI.height+"px",
						"padding-left": lI.width+5+"px"
					};
					domStyle.set(legendRow, legendRowStyle);
				}));
			}

			var layerSwitcher = domConstruct.create("div", {}, bspiLegendDiv, "last");
			var layerCheckbox = new CheckBox({checked: true});
			layerCheckbox.placeAt(layerSwitcher, "first");
			on(layerCheckbox, "change", lang.hitch(this, function(checked) {
				if (checked) {
					this.bspiLayer.setVisibility(true);
				}
				else {
					this.bspiLayer.setVisibility(false);
				}
				this.setSwipeLayer();
			}));
			domConstruct.create("span", {"innerHTML": "Show BSPI layer"}, layerSwitcher, "last");

			var bspiTopButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Show BSPI layer on top"}, bspiLegendDiv, "last");
			var bspiDownloadButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Download BSPI layer"}, bspiLegendDiv, "last");
			var bspiRemoveButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px; color: #E61D2B", innerHTML: "Remove BSPI layer"}, bspiLegendDiv, "last");

			on(bspiTopButton, "click", lang.hitch(this, function() {
				if (this.bspiLayer != null) {
					var topPos = this.map.layerIds.length-1;
					this.map.reorderLayer(this.bspiLayer, topPos);
					this.setSwipeLayer();
				}
			}));

			on(bspiDownloadButton, "click", lang.hitch(this, function() {
				if (this.bspiLayer != null) {
					window.location = this.bspiDownloadLink;
				}
			}));

			on(bspiRemoveButton, "click", lang.hitch(this, function() {
				if (this.bspiLayer != null) {
					this.removeBSPILayer();
				}
			}));

			document.getElementById("bspiLegendDiv").style.display = "block";
			document.getElementById("legendDiv").style.display = "block";
		},

		removeBSIILayer: function() {
			this.map.removeLayer(this.bsiiLayer);
			this.bsiiCalculated = false;
			this.bsiiLayer = null;
			domConstruct.empty(dojo.byId("bsiiLegendDiv"));
			document.getElementById("bsiiLegendDiv").style.display = "none";
			if (this.bspiLayer == null) {
				document.getElementById("legendDiv").style.display = "none";
			}
			this.setSwipeLayer();
		},

		removeBSPILayer: function() {
			this.map.removeLayer(this.bspiLayer);
			this.bspiCalculated = false;
			this.bspiLayer = null;
			domConstruct.empty(dojo.byId("bspiLegendDiv"));
			document.getElementById("bspiLegendDiv").style.display = "none";
			if (this.bsiiLayer == null) {
				document.getElementById("legendDiv").style.display = "none";
			}
			this.setSwipeLayer();
		},

		createLink: function(data) {
			//console.log(data);
			return ("<a href=#>"+data+"</a>");
		}
	});
});
