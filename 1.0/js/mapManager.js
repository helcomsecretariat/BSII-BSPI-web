define([
	"dojo/_base/declare",
	"dojo/dom", "dojo/dom-construct",
	"dojo/_base/lang",
	"dojo/dom-style",
	"dojo/_base/array",
	"dojo/on",
	"esri/map", "esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/InfoTemplate", "esri/dijit/Popup", "esri/symbols/SimpleFillSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color",
	"widgets/infoSection", "widgets/calculationSection", "widgets/layerListSection"
], function(
	declare, dom, domConstruct, lang, domStyle, array, on,
	Map, ArcGISDynamicMapServiceLayer,
	InfoTemplate, Popup, SimpleFillSymbol, SimpleLineSymbol, Color,
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
			bspi: false
		},
		identifyInfoContent: {
			bsiiValue: null,
			bspiValue: null,
			ec_plValues: []
		},

		constructor: function(params) {
			var services = params.services;
			var metadata = params.metadata;
			var layerNames = params.layerNames;

			var popup = new Popup({
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

			/*this.legend = new Legend({
				map: this.map
			}, "legendDiv");
			this.legend.startup();*/

			this.map.on("load", lang.hitch(this, function(layer) {
				this.tabs.i = new infoSection();
				this.tabs.c = new calculationSection({services: services, layerNames: layerNames, map: this.map});
				dijit.byId("mainWindow").resize();
				this.addLayers(services.displayLayers);
			}));

			this.map.on("layers-add-result", lang.hitch(this, function(e) {
				if (this.tabs.l == null) {
					this.tabs.l = new layerListSection({map: this.map, metadata: metadata});
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
				document.getElementById("loadingCover").style.display = "block";
				this.identifyEC_PL(evt);
				if (this.tabs.c.bsiiCalculated) {
					this.identifyBSII(evt);
				}
				if (this.tabs.c.bspiCalculated) {
					this.identifyBSPI(evt);
				}
			}));
		},

		addLayers: function(url) {
			var service = new ArcGISDynamicMapServiceLayer(url, {
				"id": "ec_pl",
				"showAttribution": false
			});
			service.setVisibleLayers([]);
			this.map.addLayers([service]);
		},

		identifyEC_PL: function(evt) {
      this.clickPoint = evt.mapPoint;
      var identify = this.tabs.l.identify;

			var idp = identify.params;
			idp.width = this.map.width;
			idp.height = this.map.height;
			idp.geometry = evt.mapPoint;
			idp.mapExtent = this.map.extent;

			identify.task.execute(idp, lang.hitch(this, this.onIdentifyEC_PLResult), lang.hitch(this, this.onIdentifyEC_PLError));
    },

		onIdentifyEC_PLResult: function(result) {
			array.forEach(result, lang.hitch(this, function(idr) {
				this.identifyInfoContent.ec_plValues.push({"layer": idr.layerName, "value": idr.feature.attributes["Pixel Value"]});
			}));
			this.identified.ec_pl = true;
			if (((!this.tabs.c.bsiiCalculated) || ((this.tabs.c.bsiiCalculated) && (this.identified.bsii))) && ((!this.tabs.c.bspiCalculated) || ((this.tabs.c.bspiCalculated) && (this.identified.bspi)))) {
				this.showPopup();
			}
		},

		onIdentifyEC_PLError: function(error) {
			document.getElementById("loadingCover").style.display = "none";
		},

		identifyBSII: function(evt) {
			this.clickPoint = evt.mapPoint;
      var identify = this.tabs.c.bsiiIdentify;

			var idp = identify.params;
			idp.width = this.map.width;
			idp.height = this.map.height;
			idp.geometry = evt.mapPoint;
			idp.mapExtent = this.map.extent;

			identify.task.execute(idp, lang.hitch(this, this.onIdentifyBSIIResult), lang.hitch(this, this.onIdentifyBSIIError));
		},

		onIdentifyBSIIResult: function(result) {
			this.identified.bsii = true;
			this.identifyInfoContent.bsiiValue = result[0].feature.attributes["Pixel Value"];
			if ((this.identified.ec_pl) && ((!this.tabs.c.bspiCalculated) || ((this.tabs.c.bspiCalculated) && (this.identified.bspi)))) {
				this.showPopup();
			}
		},

		onIdentifyBSIIError: function(error) {
			document.getElementById("loadingCover").style.display = "none";
		},

		identifyBSPI: function(evt) {
			this.clickPoint = evt.mapPoint;
      var identify = this.tabs.c.bspiIdentify;

			var idp = identify.params;
			idp.width = this.map.width;
			idp.height = this.map.height;
			idp.geometry = evt.mapPoint;
			idp.mapExtent = this.map.extent;

			identify.task.execute(idp, lang.hitch(this, this.onIdentifyBSPIResult), lang.hitch(this, this.onIdentifyBSPIError));
		},

		onIdentifyBSPIResult: function(result) {
			this.identified.bspi = true;
			this.identifyInfoContent.bspiValue = result[0].feature.attributes["Pixel Value"];
			if ((this.identified.ec_pl) && ((!this.tabs.c.bsiiCalculated) || ((this.tabs.c.bsiiCalculated) && (this.identified.bsii)))) {
				this.showPopup();
			}
		},

		onIdentifyBSPIError: function(error) {
			document.getElementById("loadingCover").style.display = "none";
		},

		showPopup: function() {
			this.map.infoWindow.setTitle("Point value");
			var infoWindowContent = "<table class='popupTable'>";
			if (this.identifyInfoContent.bsiiValue != null) {
				infoWindowContent = infoWindowContent + "<tr><td>BSII value</td><td>" + this.identifyInfoContent.bsiiValue + "</td></tr>";
			}
			if (this.identifyInfoContent.bspiValue != null) {
				infoWindowContent = infoWindowContent + "<tr><td>BSPI value</td><td>" + this.identifyInfoContent.bspiValue + "</td></tr>";
			}
			array.forEach(this.identifyInfoContent.ec_plValues, lang.hitch(this, function(val) {
				infoWindowContent = infoWindowContent + "<tr><td>" + val.layer + "</td><td>" + val.value + "</td></tr>";
			}));
			infoWindowContent = infoWindowContent + "</table>";
			this.map.infoWindow.setContent(infoWindowContent);
			this.map.infoWindow.show(this.clickPoint);
			this.identified.ec_pl = false;
			this.identified.bsii = false;
			this.identified.bspi = false;
			this.identifyInfoContent.ec_plValues = [];
			this.identifyInfoContent.bsiiValue = null;
			this.identifyInfoContent.bspiValue = null;
			document.getElementById("loadingCover").style.display = "none";
		}
  });
});
