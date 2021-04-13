define([
	"dojo/_base/declare",
	"dojo/dom", "dojo/dom-construct",
	"dojo/_base/lang",
	"dojo/dom-style",
	"dojo/_base/array",
	"dojo/on",
	"esri/map", "esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/InfoTemplate", "esri/dijit/Popup", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleFillSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color",
	"esri/tasks/IdentifyTask", "esri/tasks/IdentifyParameters", "esri/layers/GraphicsLayer", "esri/graphic", "esri/geometry/Point",
	"esri/tasks/Geoprocessor",
	"widgets/infoSection", "widgets/calculationSection", "widgets/layerListSection"
], function(
	declare, dom, domConstruct, lang, domStyle, array, on,
	Map, ArcGISDynamicMapServiceLayer,
	InfoTemplate, Popup, SimpleMarkerSymbol, SimpleFillSymbol, SimpleLineSymbol, Color,
	IdentifyTask, IdentifyParameters, GraphicsLayer, Graphic, Point,
	Geoprocessor,
	infoSection, calculationSection, layerListSection
) {
	return declare(null, {
		map: null,
		clickPoint: null,
		tabs: {
			i: null,
			c: null,
			l: null
		},
		identified: {
			ec_pl: false,
			bsii: false,
			bspi: false,
			indices: false
		},
		indentify_x: null,
		indentify_y: null,
		identifyInfoContent: {
			bsiiEcContrib : null,
			bsiiPlContrib : null,
			bspiContrib : null,
			ec_plValues: []
		},
		identifyIndicesObj: null,
		bsiiContributionService: null,
		bspiContributionService: null,
		highlightLayer: {},

		constructor: function(params) {
			let services = params.services;
			let ecConfig = params.ecConfig;
			let plConfig = params.plConfig;

			this.bsiiContributionService = services.contributionBSIIServise;
			this.bspiContributionService = services.contributionBSPIServise;

			let popup = new Popup({
          fillSymbol: new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.25]))
        }, domConstruct.create("div"));

			this.map = new Map("map", {
				basemap: "dark-gray-vector",
				center: [10, 60],
        zoom: 4,
        sliderPosition: "top-right",
				infoWindow: popup
      });

			this.createIndicesIdentify(services.indicesLayers);
			this.createHighlightLayer();

			this.map.on("load", lang.hitch(this, function(layer) {
				this.tabs.i = new infoSection();
				this.tabs.c = new calculationSection({services: services, map: this.map, ecConfig: ecConfig, plConfig: plConfig});
				dijit.byId("mainWindow").resize();
				this.addLayers(services.displayLayers, services.indicesLayers);
			}));

			this.map.on("layers-add-result", lang.hitch(this, function(e) {
				if (this.tabs.l == null) {
					this.tabs.l = new layerListSection({map: this.map, ecConfig: ecConfig, plConfig: plConfig});
					dijit.byId("mainWindow").resize();
				}
			}));

			this.map.on("update-start", lang.hitch(this, function(e) {
				document.getElementById("loadingCover").style.display = "block";
			}));
			this.map.on("update-end", lang.hitch(this, function(e) {
				document.getElementById("loadingCover").style.display = "none";
			}));

			this.map.on("click", lang.hitch(this, function(evt) {
				this.highlightLayer.graphicsLayer.clear();
				document.getElementById("loadingCover").style.display = "block";
				this.cleanInfoSide();
				this.indentify_x = null;
				this.indentify_y = null;
				this.identifyInfoContent.bsiiEcContrib = null;
				this.identifyInfoContent.bsiiPlContrib = null;
				this.identifyInfoContent.bspiContrib = null;
				this.identifyInfoContent.ec_plValues = [];

				this.identified.ec_pl = false;
				this.identified.indices = false;
				this.identified.bsii = false;
				this.identified.bspi = false;

				this.identifyEC_PL(evt);
				if ((this.tabs.c.bsiiCalculated) || (this.tabs.c.bspiCalculated)) {
					this.identifyIndices(evt);
				}
				else {
					this.identified.indices = true;
				}
			}));
		},

		createHighlightLayer: function() {
			this.highlightLayer.graphicsLayer = new GraphicsLayer();
			this.map.addLayer(this.highlightLayer.graphicsLayer);
			this.highlightLayer.symbol = new SimpleMarkerSymbol(
				SimpleMarkerSymbol.STYLE_CIRCLE,
				12,
				new SimpleLineSymbol(
					SimpleLineSymbol.STYLE_SOLID,
					new Color([255, 0, 0, 1.0]),
					2
				),
				new Color([0, 0, 0, 0.0])
			);
		},

		addLayers: function(ec_pl_url, indices_url) {
			let ec_pl_layers = new ArcGISDynamicMapServiceLayer(ec_pl_url, {
				"id": "ec_pl",
				"showAttribution": false
			});
			ec_pl_layers.setVisibleLayers([]);
			let indices_layers = new ArcGISDynamicMapServiceLayer(indices_url, {
				"id": "indices",
				"showAttribution": false
			});
			indices_layers.setVisibleLayers([]);
			this.map.addLayers([ec_pl_layers, indices_layers]);
		},

		createIndicesIdentify: function(url) {
			let idp = new IdentifyParameters();
			idp.tolerance = 1;
			idp.returnGeometry = false;
			idp.layerOption = IdentifyParameters.LAYER_OPTION_ALL;
			//idp.layerIds = [];

			this.identifyIndicesObj = {
				"task": new IdentifyTask(url),
				"params": idp
			};
		},

		identifyEC_PL: function(evt) {
      this.clickPoint = evt.mapPoint;
			this.highlightLayer.graphicsLayer.add(new Graphic(this.clickPoint, this.highlightLayer.symbol));
			let identify = this.tabs.l.identify;

			let idp = identify.params;
			idp.width = this.map.width;
			idp.height = this.map.height;
			idp.geometry = evt.mapPoint;
			idp.mapExtent = this.map.extent;

			identify.task.execute(idp, lang.hitch(this, this.onIdentifyEC_PLResult), lang.hitch(this, this.onIdentifyEC_PLError));
    },

		onIdentifyEC_PLResult: function(result) {
			array.forEach(result, lang.hitch(this, function(idr) {
				this.identifyInfoContent.ec_plValues.push({"layer": idr.layerName, "value": parseFloat(idr.feature.attributes["Pixel Value"]).toFixed(2)});
			}));

			if (this.identifyInfoContent.ec_plValues.length > 0) {
				this.map.infoWindow.setTitle("Location information");
				let infoWindowContent = "<table class='popupTable'>";

				array.forEach(this.identifyInfoContent.ec_plValues, lang.hitch(this, function(val) {
					infoWindowContent = infoWindowContent + "<tr><td>" + val.layer + "</td><td>" + val.value + "</td></tr>";
				}));
				infoWindowContent = infoWindowContent + "</table>";
				this.map.infoWindow.setContent(infoWindowContent);
				this.map.infoWindow.show(this.clickPoint);
			}

			this.identified.ec_pl = true;
			if (this.identified.indices) {
				if (this.tabs.c.bsiiCalculated) {
					this.contributionBSII();
				}
				else {
					this.identified.bsii = true;
				}
				if (this.tabs.c.bspiCalculated) {
					this.contributionBSPI();
				}
				else {
					this.identified.bspi = true;
				}
				if ((!this.tabs.c.bsiiCalculated) && (!this.tabs.c.bspiCalculated)) {
					this.showPopup();
				}
			}
		},

		onIdentifyEC_PLError: function(error) {
			document.getElementById("loadingCover").style.display = "none";
		},

		identifyIndices: function(evt) {
			let idp = this.identifyIndicesObj.params;
			idp.width = this.map.width;
			idp.height = this.map.height;
			idp.geometry = evt.mapPoint;
			idp.mapExtent = this.map.extent;

			this.identifyIndicesObj.task.execute(idp, lang.hitch(this, this.onIdentifyIndicesResult), lang.hitch(this, this.onIdentifyIndicesError));
    },

		onIdentifyIndicesResult: function(result) {

			let index_x = null;
			let index_y = null;
			array.forEach(result, lang.hitch(this, function(idr) {
				if (idr.layerId == 0) {
					this.indentify_x = idr.feature.attributes["Pixel Value"].split(".")[0];
				}
				if (idr.layerId == 1) {
					this.indentify_y = idr.feature.attributes["Pixel Value"].split(".")[0];
				}
			}));
			this.identified.indices = true;
			if (this.identified.ec_pl) {
				if (this.tabs.c.bsiiCalculated) {
					this.contributionBSII();
				}
				else {
					this.identified.bsii = true;
				}
				if (this.tabs.c.bspiCalculated) {
					this.contributionBSPI();
				}
				else {
					this.identified.bspi = true;
				}
			}
		},

		onIdentifyIndicesError: function(error) {
			console.log(error);
			document.getElementById("loadingCover").style.display = "none";
		},

		contributionBSII: function() {
			let gp = new Geoprocessor(this.bsiiContributionService);
			let params = {"x": this.indentify_x, "y": this.indentify_y, "data": this.tabs.c.bsiiData};
			gp.submitJob(params, gpJobComplete, gpJobStatus, gpJobFailed);
			let that = this;

			function gpJobComplete(jobinfo) {
				if (jobinfo.jobStatus == "esriJobSucceeded") {
					gp.getResultData(jobinfo.jobId, "error", function(erdata) {
						if (erdata.value == "1") {
							let ec_received = false;
							let pl_received = false;
							gp.getResultData(jobinfo.jobId, "resultec", function(data) {
								const hasKeys = !!Object.keys(data.value).length;
								if (hasKeys) {
									that.identifyInfoContent.bsiiEcContrib = data.value;
								}
								ec_received = true;
								if (pl_received) {
									that.identified.bsii = true;
									if (that.identified.bspi) {
										that.showPopup();
									}
								}
				      });

							gp.getResultData(jobinfo.jobId, "resultpl", function(data) {
								const hasKeys = !!Object.keys(data.value).length;
								if (hasKeys) {
									that.identifyInfoContent.bsiiPlContrib = data.value;
								}
								pl_received = true;
								if (ec_received) {
									that.identified.bsii = true;
									if (that.identified.bspi) {
										that.showPopup();
									}
								}
				      });
						}
						else {
							that.identified.bsii = true;
							if (that.identified.bspi) {
								that.showPopup();
							}
						}
		      });
				}
				else {
					console.log(jobinfo);
					alert("Unable to calculate BSII contribution values. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
					that.identified.bsii = true;
					if (that.identified.bspi) {
						that.showPopup();
					}
				}
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
				console.log("gpJobFailed", error);
				alert("Unable to calculate BSII contribution values. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
				that.identified.bsii = true;
				if (that.identified.bspi) {
					that.showPopup();
				}
			}
		},

		contributionBSPI: function() {
			let gp = new Geoprocessor(this.bspiContributionService);
			let params = {"x": this.indentify_x, "y": this.indentify_y, "type": this.tabs.c.bspiMode, "data": this.tabs.c.bspiData};
			gp.submitJob(params, gpJobComplete, gpJobStatus, gpJobFailed);
			let that = this;

			function gpJobComplete(jobinfo) {
				if (jobinfo.jobStatus == "esriJobSucceeded") {
					gp.getResultData(jobinfo.jobId, "error", function(erdata) {
						if (erdata.value == "1") {
							gp.getResultData(jobinfo.jobId, "resultpl", function(data) {
								const hasKeys = !!Object.keys(data.value).length;
								if (hasKeys) {
									that.identifyInfoContent.bspiContrib = data.value;
								}
								that.identified.bspi = true;
								if (that.identified.bsii) {
									that.showPopup();
								}
				      });
						}
						else {
							that.identified.bspi = true;
							if (that.identified.bsii) {
								that.showPopup();
							}
						}
		      });
				}
				else {
					console.log(jobinfo);
					alert("Unable to calculate BSPI contribution values. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
					that.identified.bspi = true;
					if (that.identified.bsii) {
						that.showPopup();
					}
				}
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
				console.log("gpJobFailed", error);
				alert("Unable to calculate BSPI contribution values. Try to reload page and run the tool again. Contact administrator at data@helcom.fi if alert appears again.");
				that.identified.bspi = true;
				if (that.identified.bsii) {
					that.showPopup();
				}
			}
		},

		showPopup: function() {
			if ((this.identifyInfoContent.bsiiEcContrib != null) || (this.identifyInfoContent.bsiiPlContrib != null) || (this.identifyInfoContent.bspiContrib != null)) {
				document.getElementById("toolSettings").style.display = "none";
				let ec_contrib = this.identifyInfoContent.bsiiEcContrib;
				let pl_contrib = this.identifyInfoContent.bsiiPlContrib;
				if (ec_contrib != null) {
					document.getElementById("bsiiMessage").innerHTML = "BSII value: " + ec_contrib.BSII;
					document.getElementById("bsiiMessage").style.display = "block";

					this.tabs.c.setDiagramData("ecBsii", ec_contrib, "EC_", "bsiiEcSeries");
					this.tabs.c.resizeDiagram("ecBsii");
					document.getElementById("ecBsiiChartContainer").style.display = "block";
				}
				if (pl_contrib != null) {
					this.tabs.c.setDiagramData("plBsii", pl_contrib, "PL_", "bsiiPlSeries");
					this.tabs.c.resizeDiagram("plBsii");
					document.getElementById("plBsiiChartContainer").style.display = "block";
				}
				if (this.identifyInfoContent.bspiContrib != null) {
					document.getElementById("bspiMessage").innerHTML = "BSPI value: " + this.identifyInfoContent.bspiContrib.BSPI;
					document.getElementById("bspiMessage").style.display = "block";

					this.tabs.c.setDiagramData("bspi", this.identifyInfoContent.bspiContrib, "PL_", "bspiSeries");
					this.tabs.c.resizeDiagram("bspi");
					document.getElementById("bspiChartContainer").style.display = "block";
				}
				document.getElementById("identifyResults").style.display = "block";
			}
			document.getElementById("loadingCover").style.display = "none";
		},

		cleanInfoSide: function() {
			document.getElementById("bsiiMessage").style.display = "none";
			document.getElementById("bspiMessage").style.display = "none";
		}
  });
});
