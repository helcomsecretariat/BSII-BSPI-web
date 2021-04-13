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
	"dojox/charting/Chart", "dojox/charting/plot2d/Pie", "dojox/charting/action2d/Highlight",
	"dojox/charting/action2d/MoveSlice" , "dojox/charting/action2d/Tooltip",
	"dojox/charting/themes/Wetland", "dojox/charting/themes/CubanShirts", "dojox/charting/widget/Legend",
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
	Chart, Pie, Highlight, MoveSlice, ChartTooltip, bsiiTheme, bspiTheme, ChartLegend,
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
		ecConfig: null,
		plConfig: null,
		calculateBSIIService: null,
		calculateBSPIService: null,
		calculationMapServer: null,
		calculationMode: null,
		bspiMode: null,
		data: null,
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
		charts: {
			ecBsii: null,
			plBsii: null,
			bspi: null
		},
		chartLegends: {
			ecBsii: null,
			plBsii: null,
			bspi: null
		},

		constructor: function(params) {
			this.ecConfig = params.ecConfig;
			this.plConfig = params.plConfig;
			this.calculateBSIIService = params.services.calculateBSIIService;
			this.calculateBSPIService = params.services.calculateBSPIService;
			this.calculationMapServer = params.services.calculationMapServer;
			this.map = params.map;
			this.utils = new utils();
			this.postCreate();
		},

		postCreate: function() {

			let idp = new IdentifyParameters();
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
				this.calculationMode = "BSII";
				document.getElementById("bsiiModeMessages").style.display = "block";
				document.getElementById("ecGroupSection").style.display = "block";
				document.getElementById("plGroupSection").style.float = "right";
				document.getElementById("plGroupSection").style.display = "block";
				document.getElementById("getLayersForGridButton").style.display = "inline-block";
				document.getElementById("gridContainer").style.display = "block";
				if (this.charts.ecBsii == null) {
					this.createDiagram("ecBsiiChart", "ecBsiiChartLegend", "ecBsii", "Ecosystem components contribution to BSII");
				}
				if (this.charts.plBsii == null) {
					this.createDiagram("plBsiiChart", "plBsiiChartLegend", "plBsii", "Pressures contribution to BSII");
				}
			}));

			on(dojo.byId("bspiSumModeButton"), "click", lang.hitch(this, function() {
				this.clean();
				this.calculationMode = "BSPI";
				this.bspiMode = "SUM";
				document.getElementById("bspiSumModeMessages").style.display = "block";
				document.getElementById("plGroupSection").style.float = "left";
				document.getElementById("plGroupSection").style.display = "block";
				document.getElementById("calculateBspiSumButton").style.display = "inline-block";
				document.getElementById("gridContainer").style.display = "none";
				if (this.charts.bspi == null) {
					this.createDiagram("bspiChart", "bspiChartLegend", "bspi", "Pressures contribution to BSPI");
				}
			}));

			on(dojo.byId("bspiWeightedModeButton"), "click", lang.hitch(this, function() {
				this.clean();
				this.calculationMode = "BSPI";
				this.bspiMode = "WEIGHTED";
				document.getElementById("bspiWeightedModeMessages").style.display = "block";
				document.getElementById("ecGroupSection").style.display = "block";
				document.getElementById("plGroupSection").style.float = "right";
				document.getElementById("plGroupSection").style.display = "block";
				document.getElementById("getLayersForGridButton").style.display = "inline-block";
				document.getElementById("gridContainer").style.display = "block";
				if (this.charts.bspi == null) {
					this.createDiagram("bspiChart", "bspiChartLegend", "bspi", "Pressures contribution to BSPI");
				}
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

				let obj = {};
				array.forEach(this.sensitivityScores.items, lang.hitch(this, function(row) {
					let key = row["EC_CODE"][0];
					let values = {};
					for (let property in row) {
  					if (row.hasOwnProperty(property)) {
							if (property.startsWith("PL_")) {
								values[property] = row[property][0];
							}
  					}
					}
					obj[key] = values;
				}));
				this.bsiiData = JSON.stringify(obj);
				document.getElementById("calculateMessage").style.display = "block";
				this.calculateBSII();
			}));

			on(dojo.byId("calculateBspiSumButton"), "click", lang.hitch(this, function() {
				document.getElementById("plLayersSelectionError").style.display = "none";
				if (this.selectedLayers.PL.length > 1) {
					document.getElementById("loadingCover").style.display = "block";
					if (this.bspiLayer != null) {
						this.removeBSPILayer();
					}
					document.getElementById("calculateMessage").style.display = "block";
					this.bspiData = JSON.stringify(this.selectedLayers.PL);
					this.calculateBSPI();
				}
				else {
					document.getElementById("plLayersSelectionError").style.display = "block";
				}
			}));

			on(dojo.byId("calculateBspiWeightedButton"), "click", lang.hitch(this, function() {
				document.getElementById("loadingCover").style.display = "block";

				if (this.bspiLayer != null) {
					this.removeBSPILayer();
				}

				let obj = {};
				let firstRow = this.sensitivityScores.items[0]
				for (let property in firstRow) {
					if (firstRow.hasOwnProperty(property)) {
						if (property.startsWith("PL_")) {
							obj[property] = {};
						}
					}
				}

				array.forEach(this.sensitivityScores.items, lang.hitch(this, function(row) {
					let key = row["EC_CODE"][0];
					for (let property in row) {
  					if (row.hasOwnProperty(property)) {
							if (property.startsWith("PL_")) {
								obj[property][key] = row[property][0];
							}
  					}
					}
				}));
				document.getElementById("calculateMessage").style.display = "block";
				this.bspiData = JSON.stringify(obj);
				this.calculateBSPI();
			}));

			on(dojo.byId("backToSettingsTop"), "click", lang.hitch(this, function() {
				document.getElementById("identifyResults").style.display = "none";
				document.getElementById("toolSettings").style.display = "block";
			}));

			on(dojo.byId("backToSettingsBottom"), "click", lang.hitch(this, function() {
				document.getElementById("identifyResults").style.display = "none";
				document.getElementById("toolSettings").style.display = "block";
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
			document.getElementById("bspiSumModeMessages").style.display = "none";
			document.getElementById("bspiWeightedModeMessages").style.display = "none";
			document.getElementById("layersSelectionError").style.display = "none";
			document.getElementById("plLayersSelectionError").style.display = "none";
			document.getElementById("resetSensitivityScores").style.display = "none";
			document.getElementById("ssMessage").style.display = "none";
			document.getElementById("calculateBsiiButton").style.display = "none";
			document.getElementById("calculateBspiSumButton").style.display = "none";
			document.getElementById("calculateBspiWeightedButton").style.display = "none";
		},

		resetSensitivityScores: function() {
			if (this.grid != null) {
				this.grid.destroy();
				this.grid = null;
			}
			document.getElementById("calculateBsiiButton").style.display = "none";
			document.getElementById("calculateBspiSumButton").style.display = "none";
			document.getElementById("calculateBspiWeightedButton").style.display = "none";
			document.getElementById("layersSelectionError").style.display = "none";
			document.getElementById("resetSensitivityScores").style.display = "none";
			document.getElementById("ssMessage").style.display = "none";
		},

		getLayers: function() {
			let ecLayers = [], plLayers = [];
			for (let property in this.ecConfig) {
				if (this.ecConfig.hasOwnProperty(property)) {
					ecLayers.push({"value": property, "label": property + ": " + this.ecConfig[property]["name"]});
					this.ecLayersForTooltip[property] = this.ecConfig[property]["name"];
				}
			}
			for (let property in this.plConfig) {
				if (this.plConfig.hasOwnProperty(property)) {
					plLayers.push({"value": property, "label": property + ": " + this.plConfig[property]["name"]});
					this.plLayersForTooltip[property] = this.plConfig[property]["name"];
				}
			}
			this.setupSelectionContainer("EC", ecLayers);
			this.setupSelectionContainer("PL", plLayers);
		},

		setupSelectionContainer: function(type, layers) {
			let title = null, container = null;
			if (type == "EC") {
				title = "Ecosystem component layers";
				container = "ecGroupSection";
			}
			else if (type == "PL") {
				title = "Pressure layers";
				container = "plGroupSection";
			}

			let tp = new TitlePane({title: title});
			tp.placeAt(dojo.byId(container));
    	tp.startup();

			let layersStore = new ItemFileReadStore({
				data: {
					identifier: "value",
					label: "label",
					items: layers
				}
			});

			let multiSel = new CheckedMultiSelect ({
				dropDown: false,
				multiple: true,
				store: layersStore,
				style : {width: "100%"},
				onChange: lang.hitch(this, function() {
					this.selectedLayers[type] = multiSel.get("value");
				})
			}, tp.containerNode);

			let selAllButton = domConstruct.create("div", {class: "leftPanelLink", innerHTML: "Select all"}, dojo.byId(container), "last");
			selAllButton.sel = false;

			on(selAllButton, "click", lang.hitch(this, function() {
				if (selAllButton.sel) {
					multiSel.set("value", []);
					multiSel._updateSelection();
					selAllButton.innerHTML = "Select all";
					selAllButton.sel = false;
				}
				else {
					let options = multiSel.getOptions();
					multiSel.set("value", options);
					multiSel._updateSelection();
					selAllButton.innerHTML = "Unselect all";
					selAllButton.sel = true;
				}
			}));
		},

		createSSGrid: function() {
			document.getElementById("loadingCover").style.display = "block";
			let layout = [
				{
					noscroll: true,
					//defaultCell: { width: "36px" },
					cells: [
						{field: "EC_CODE", name: "CODE", width: "36px", classes: "firstCol"}
          ]
				},
				{
					//defaultCell: { width: "36px" },
					cells: []
				}
			];

			array.forEach(this.selectedLayers.PL, lang.hitch(this, function(pl) {
				layout[1].cells.push({field: pl, name: pl, width: "36px", editable: true});
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
				style: "width: 100%; height: 400px;",
        structure: layout/*,
				autoHeight: true,
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

			let i = 1;
			for (let ec in this.ecConfig) {
				if (this.ecConfig.hasOwnProperty(ec)) {
					if (this.selectedLayers.EC.includes(ec)) {
						let obj = {
							"id": i,
							"EC_CODE": ec
						};
						for (let pl in this.ecConfig[ec].ss) {
							if (this.ecConfig[ec].ss.hasOwnProperty(pl)) {
								if (this.selectedLayers.PL.includes(pl)) {
									obj[pl] = this.ecConfig[ec].ss[pl];
								}
							}
						}
						this.sensitivityScores.items.push(obj);
						i += 1;
					}
				}
			}

			this.sensitivityScoresStore = new ItemFileWriteStore({data: this.sensitivityScores});
			this.grid.setStore(this.sensitivityScoresStore);
			document.getElementById("resetSensitivityScores").style.display = "inline";
			document.getElementById("ssMessage").style.display = "block";
			if (this.calculationMode == "BSII") {
				document.getElementById("calculateBsiiButton").style.display = "inline-block";
			}
			else if (this.calculationMode == "BSPI") {
				document.getElementById("calculateBspiWeightedButton").style.display = "inline-block";
			}
			document.getElementById("loadingCover").style.display = "none";
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

			let swipeSwitcher = domConstruct.create("div", {}, swipeLayerDiv, "last");
			let swipeCheckbox = new CheckBox({checked: true});
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
				let layerIds = this.map.layerIds;
				let topPos = layerIds.length-1;
				let swipeLayer = null;
				let layer = this.map.getLayer(layerIds[topPos]);
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

		calculateBSII: function() {
			let gp = new Geoprocessor(this.calculateBSIIService);
			console.log(this.bsiiData);
			let params = {"data": this.bsiiData};
			gp.submitJob(params, gpJobComplete, gpJobStatus, gpJobFailed);
			let that = this;

			function gpJobComplete(jobinfo) {
				if (jobinfo.jobStatus == "esriJobSucceeded") {
					let imageParams = new ImageParameters();
					imageParams.imageSpatialReference = this.map.spatialReference;
					gp.getResultImageLayer(jobinfo.jobId, "rasterweb", imageParams, function(layer) {
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

					gp.getResultData(jobinfo.jobId, "rasterdownload", function(data) {
						that.bsiiDownloadLink = data.value.url;
		      });

					gp.getResultData(jobinfo.jobId, "csvfile", function(csv) {
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

		calculateBSPI: function() {
			let gp = new Geoprocessor(this.calculateBSPIService);
			console.log(this.bspiData);
			let params = {"type": this.bspiMode, "data": this.bspiData};
			gp.submitJob(params, gpJobComplete, gpJobStatus, gpJobFailed);
			let that = this;

			function gpJobComplete(jobinfo) {
				if (jobinfo.jobStatus == "esriJobSucceeded") {
					let imageParams = new ImageParameters();
					imageParams.imageSpatialReference = this.map.spatialReference;
					gp.getResultImageLayer(jobinfo.jobId, "rasterweb", imageParams, function(layer) {
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

					gp.getResultData(jobinfo.jobId, "rasterdownload", function(data) {
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
			let bsiiLegendDiv = dojo.byId("bsiiLegendDiv");
			domConstruct.create("div", { style: "font-size: 16px;", "innerHTML": "BSII layer" }, bsiiLegendDiv, "last");
			if (data.layers) {
				array.forEach(data.layers[0].legend, lang.hitch(this, function(lI) {
					let legendRow = domConstruct.create("div", { "class": "legendRow" }, bsiiLegendDiv, "last");

					legendRow.innerHTML = lI.label;
					let legendRowStyle = {
						"background-image": 'url("data:image/png;base64,'+lI.imageData+'")',
						"line-height": lI.height+"px",
						"padding-left": lI.width+5+"px"
					};
					domStyle.set(legendRow, legendRowStyle);
				}));
			}

			let layerSwitcher = domConstruct.create("div", {}, bsiiLegendDiv, "last");
			let layerCheckbox = new CheckBox({checked: true});
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

			let bsiiTopButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Show BSII layer on top"}, bsiiLegendDiv, "last");
			let bsiiDownloadButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Download BSII layer"}, bsiiLegendDiv, "last");
			let csvDownloadButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Download BSII statistics"}, bsiiLegendDiv, "last");
			let bsiiRemoveButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px; color: #E61D2B", innerHTML: "Remove BSII layer"}, bsiiLegendDiv, "last");

			on(bsiiTopButton, "click", lang.hitch(this, function() {
				if (this.bsiiLayer != null) {
					let topPos = this.map.layerIds.length-1;
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
			let bspiLegendDiv = dojo.byId("bspiLegendDiv");
			domConstruct.create("div", { style: "font-size: 16px;", "innerHTML": "BSPI layer" }, bspiLegendDiv, "last");
			if (data.layers) {
				array.forEach(data.layers[0].legend, lang.hitch(this, function(lI) {
					let legendRow = domConstruct.create("div", { "class": "legendRow" }, bspiLegendDiv, "last");

					legendRow.innerHTML = lI.label;
					let legendRowStyle = {
						"background-image": 'url("data:image/png;base64,'+lI.imageData+'")',
						"line-height": lI.height+"px",
						"padding-left": lI.width+5+"px"
					};
					domStyle.set(legendRow, legendRowStyle);
				}));
			}

			let layerSwitcher = domConstruct.create("div", {}, bspiLegendDiv, "last");
			let layerCheckbox = new CheckBox({checked: true});
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

			let bspiTopButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Show BSPI layer on top"}, bspiLegendDiv, "last");
			let bspiDownloadButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px;", innerHTML: "Download BSPI layer"}, bspiLegendDiv, "last");
			let bspiRemoveButton = domConstruct.create("div", {class: "leftPanelLink", style: "font-size: 12px; color: #E61D2B", innerHTML: "Remove BSPI layer"}, bspiLegendDiv, "last");

			on(bspiTopButton, "click", lang.hitch(this, function() {
				if (this.bspiLayer != null) {
					let topPos = this.map.layerIds.length-1;
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
			this.bsiiData = null;
			this.bsiiLayer = null;
			domConstruct.empty(dojo.byId("bsiiLegendDiv"));
			document.getElementById("bsiiLegendDiv").style.display = "none";
			if (this.bspiLayer == null) {
				document.getElementById("legendDiv").style.display = "none";
			}
			document.getElementById("bsiiMessage").style.display = "none";
			document.getElementById("ecBsiiChartContainer").style.display = "none";
			document.getElementById("plBsiiChartContainer").style.display = "none";
			this.setSwipeLayer();
		},

		removeBSPILayer: function() {
			this.map.removeLayer(this.bspiLayer);
			this.bspiCalculated = false;
			this.bspiData = null;
			this.bspiLayer = null;
			domConstruct.empty(dojo.byId("bspiLegendDiv"));
			document.getElementById("bspiLegendDiv").style.display = "none";
			if (this.bsiiLayer == null) {
				document.getElementById("legendDiv").style.display = "none";
			}
			document.getElementById("bspiMessage").style.display = "none";
			document.getElementById("bspiChartContainer").style.display = "none";
			this.setSwipeLayer();
		},

		createLink: function(data) {
			return ("<a href=#>"+data+"</a>");
		},

		createDiagram: function(chartDiv, legendDiv, type, title) {
			let chart = new Chart(chartDiv);
			if (type.endsWith("Bsii")) {
				chart.setTheme(bsiiTheme);
			}
			if (type.endsWith("bspi")) {
				chart.setTheme(bspiTheme);
			}
			chart.addPlot("default", {
        type: Pie,
				labels: false,
    		labelOffset: 0,
        radius: 80
    	});

			new MoveSlice(chart, "default");
    	new Highlight(chart, "default");
    	new ChartTooltip(chart, "default");
    	this.charts[type] = chart;
			this.chartLegends[type] = new ChartLegend({chart: this.charts[type], horizontal: false, style: "margin-left: 5px;"}, legendDiv);
		},

		setDiagramData: function(chart, data, prefix, seriesName) {
			let series = [];
			for (let property in data) {
				if (data.hasOwnProperty(property)) {
					if (property.startsWith(prefix)) {
						let label = null;
						if (prefix == "EC_") {
							label = this.ecConfig[property]["name"];
						}
						else if (prefix == "PL_") {
							label = this.plConfig[property]["name"];
						}
						let serie = {
							y: data[property],
							text: label + " (" + data[property] + " %)",
							tooltip: label + " (" + data[property] + " %)",
							stroke: "black"
						};
						series.push(serie);
					}
				}
			}
			this.charts[chart].addSeries(seriesName, series);
			this.charts[chart].render();

			this.chartLegends[chart].refresh();
			setTimeout(lang.hitch(this, function() {
					this.resizeDiagram(chart);
				},
				3000
			));
		},

		resizeDiagram: function(chart) {
			this.charts[chart].resize();
			dijit.byId("mainWindow").resize();
		}
	});
});
