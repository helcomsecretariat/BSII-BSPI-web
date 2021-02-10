define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo",
	"dojo/on",
	"dojo/dom",
	"dojo/dom-style",
	"dojo/_base/array", "dojo/dom-construct",
	"dijit/Tooltip", "dojo/store/Memory","dijit/tree/ObjectStoreModel", "dijit/Tree",
	"esri/tasks/IdentifyTask", "esri/tasks/IdentifyParameters",
	"app/js/utils"
], function(
	declare,
	lang,
	dojo,
	on,
	dom,
	domStyle,
	array, domConstruct,
	Tooltip, Memory, ObjectStoreModel, Tree,
	IdentifyTask, IdentifyParameters,
	utils
){
	return declare(null, {
		utils: null,
		map: null,
		metadata: null,
		layerService: null,
		legendInfo: [],
		tree: null,
    store: null,
    data: [{ id: 'layerlist', leaf: false}],
		identify : null,

		constructor: function(params) {
			this.map = params.map;
			this.metadata = params.metadata;
			this.utils = new utils();
			//console.log("layerList", this.map);
			this.postCreate();
		},

		postCreate: function() {
			this.layerService = this.map.getLayer("ec_pl");
			var idp = new IdentifyParameters();
			idp.tolerance = 6;
			idp.returnGeometry = true;
			idp.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;
			idp.layerIds = [];

			this.identify = {
				"task": new IdentifyTask(this.layerService.url),
				"params": idp
			};

			this.getLegendInfo();
			this.createDataArray();

			/*on(dojo.byId("resetSensitivityScores"), "click", lang.hitch(this, function() {
				this.clean();
			}));*/
		},

		clean: function() {

		},

		getLegendInfo: function() {
      var requestHandle = null;
			fetch(this.layerService.url+"/legend?f=pjson")
				.then(lang.hitch(this, function(response) {
					return response.text();
				}))
				.then(lang.hitch(this, function(text) {
					var resp = JSON.parse(text);

					array.forEach(resp.layers, lang.hitch(this, function(layer) {
						this.legendInfo[layer.layerId] = layer.legend;
					}));
				}));
    },

		createDataArray: function() {

			//this.data.push({id: "ec_pl_top", parent: "layerlist", name: "ec_pl", topGroup: true, leaf: false});
			array.forEach(this.layerService.layerInfos, lang.hitch(this, function(lyrInfo) {
				// check if layer is a leaf
				var isLeaf = false;
				if (lyrInfo.subLayerIds) {
					isLeaf = false;
				}
				else {
					isLeaf = true;
				}
				// add all levels and set parent levels
				if (lyrInfo.parentLayerId === -1) {
					this.data.push({id: "ec_pl_"+lyrInfo.id, parent: "layerlist", name: lyrInfo.name, topGroup: false, leaf: isLeaf, visibilityId: lyrInfo.id});
				}
				else {
					this.data.push({id: "ec_pl_"+lyrInfo.id, parent: "ec_pl_"+lyrInfo.parentLayerId, name: lyrInfo.name, code: lyrInfo.name.split(":")[0], topGroup: false, leaf: isLeaf, visibilityId: lyrInfo.id});
				}
			}));
			this.createTree();
    },

		createTree: function() {
      var mapa = this.map;
			//var legenda = this.legend;
      var that = this;

      //var topServiceIndex = mapa.layerIds.length - 1;
      //var visitedNodesIds = this.visitedNodesIds;
      //var identify = this.identify;
      var legendInfo = this.legendInfo;
			var serviceLayer = this.layerService;
			var identify = this.identify;
      var myStore = new Memory({
        data: this.data,
        getChildren: function(object){
            return this.query({parent: object.id});
        }
      });
      this.store = myStore;
      var myModel = new ObjectStoreModel({
        store: myStore,
        query: {id: 'layerlist'}
      });

      this.tree = new Tree({
        model: myModel,
        showRoot: false,
        getIconClass:function(item, opened){

        },
        getNodeFromItem: function (id) {
          return this._itemNodesMap[ id ][0];
        },

        _createTreeNode: function(args) {
          var tnode = new dijit._TreeNode(args);
          tnode.labelNode.innerHTML = args.label;

          // get the service layer
          //var serviceLayer = mapa.getLayer(tnode.item.layer);

          // if tree node is a service layer
          if (tnode.item.topGroup) {/*
            // create an arrow button to open menu
            var topGroupButton = domConstruct.create("div", { "class": "topGroupButton" }, tnode.rowNode, "last");
            // open menu and hide previously open menu
            on(topGroupButton, "click", function(){
                query(".layerTopGroupMenu").forEach(function(node) {
                domStyle.set(node, {"display": "none"});
              });
              var pos = dojo.position(topGroupButton, true);
              domStyle.set(layerTopGroupMenu, {"top": pos.y +13+"px", "left": pos.x+"px", "display": "block"});
            });

            // create a menu
            var layerTopGroupMenu = domConstruct.create("div", { "class": "layerTopGroupMenu" }, win.body(), "last");
            // create close button
            var closeButton = domConstruct.create("div", { "class": "layerTopGroupMenuClose", "style": "margin-bottom: 20px" }, layerTopGroupMenu, "last");
            // on up thing clicked change layer order, move tree node and reposition menu
            on(closeButton, "click", function(){
              query(".layerTopGroupMenu").forEach(function(node){
                domStyle.set(node, {"display": "none"});
              });
            });

            // create opacity thing
            var opacityThing = domConstruct.create("div", { "class": "layerTopGroupMenuContainer", "style": "margin-bottom: 20px" }, layerTopGroupMenu, "last");
            var opacityLabel = domConstruct.create("div", { "class": "layerTopGroupMenuLabels", innerHTML: "Layers opacity" }, opacityThing, "first");
            var sliderDiv = domConstruct.create("div", { "class": "sliderDiv" }, opacityThing, "last");
            var slider = new HorizontalSlider({
              name: "slider",
              value: serviceLayer.opacity,
              minimum: 0,
              maximum: 1,
              intermediateChanges: true,
              showButtons: false,
              onChange: function(value) {
                serviceLayer.setOpacity(value);
              }
            }, sliderDiv);

            var sliderLabelsNode = domConstruct.create("div", {}, opacityThing, "last");
            var sliderLabels = new HorizontalRuleLabels({
              container: "bottomDecoration",
              labelStyle: "font-size: 10px;",
              labels: ["min", "max"]
            }, sliderLabelsNode);

            slider.startup();
            sliderLabels.startup();

            // create move up and down things
            var upThing = domConstruct.create("div", { "class": "layerTopGroupMenuMoveUp", innerHTML: "Move up" }, layerTopGroupMenu, "last");
            var downThing = domConstruct.create("div", { "class": "layerTopGroupMenuMoveDown", innerHTML: "Move down" }, layerTopGroupMenu, "last");

            // on up thing clicked change layer order, move tree node and reposition menu
            on(upThing, "click", function() {
              if (mapa.layerIds.indexOf(tnode.item.name) < topServiceIndex) {
                mapa.reorderLayer(serviceLayer, mapa.layerIds.indexOf(tnode.item.name)+1);
                dojo.place(tnode.domNode, tnode.domNode.previousSibling, "before");
                var pos = dojo.position(topGroupButton, true);
                domStyle.set(layerTopGroupMenu, {"top": pos.y +13+"px", "left": pos.x+"px", "display": "block"});
              }
            });

            // on down thing clicked change layer order, move tree node and reposition menu
            on(downThing, "click", function() {
              // because of the Basemap layer has always index 0, check layers position before reordering
              if (mapa.layerIds.indexOf(tnode.item.name) > 1) {
                mapa.reorderLayer(serviceLayer, mapa.layerIds.indexOf(tnode.item.name)-1);
                dojo.place(tnode.domNode, tnode.domNode.nextSibling, "after");
                var pos = dojo.position(topGroupButton, true);
                domStyle.set(layerTopGroupMenu, {"top": pos.y +13+"px", "left": pos.x+"px", "display": "block"});
              }
            });

            // create WMS link
            var wmsLink = domConstruct.create("a", { "class": "layerTopGroupMenuWmsLink", innerHTML: "WMS", href: tnode.item.wms, target: "_blank" }, layerTopGroupMenu, "last");
*/
          }
          // if tree node is a data layer
          else if (tnode.item.leaf) {
            dojo.destroy(tnode.expandoNode);
            var cb = new dijit.form.CheckBox();
            cb.placeAt(tnode.contentNode, "first");

            // metadata button
            var metadataButton = domConstruct.create("div", { "class": "metadataButton" }, tnode.contentNode, "last");
            new Tooltip({
              connectId: [metadataButton],
              showDelay: 10,
              label: "View metadata"
            });

            // set sublayers label width depending on sublayer level in the tree
            var rowNodePadding = domStyle.get(tnode.rowNode, "padding-left");
            var labelNodeWidth = 258 - rowNodePadding;
            domStyle.set(tnode.labelNode, {"width": labelNodeWidth+"px"});

            // create legend node
            var legendContainerDiv = domConstruct.create("div", { "style": "display: none;" }, tnode.rowNode, "last");

            var lIs = legendInfo[tnode.item.visibilityId];
            // create legend row
            array.forEach(lIs, lang.hitch(this, function(lI) {
              var legendRow = domConstruct.create("div", { "class": "legendRow" }, legendContainerDiv, "last");

              legendRow.innerHTML = lI.label;
              var legendRowStyle = {
                "background-image": 'url("'+serviceLayer.url+'/'+tnode.item.visibilityId+'/images/' + lI.url+'")',
                "line-height": lI.height+"px",
                "padding-left": lI.width+5+"px",
                "margin-left": "22px",
                "width": 238-rowNodePadding+"px"
              };
              domStyle.set(legendRow, legendRowStyle);
            }));

            var attributeTable = null;
            // on sublayer check box click
            on(cb, "change", function(checked){
              var visible = serviceLayer.visibleLayers;
							//legenda.refresh();

              if (checked) {
                that.addingLayer = true;
                //domStyle.set(dojo.byId("loadingCover"), {"display": "block"});
                // make sublayer visible
                visible.push(tnode.item.visibilityId);
                serviceLayer.setVisibleLayers(visible);

                // show legend
                domStyle.set(legendContainerDiv, "display", "block");

                // add sublayer for identify task
                identify.params.layerIds.push(tnode.item.visibilityId);

                // set tree path nodes style on select
                /*array.forEach(tnode.tree.paths, lang.hitch(this, function(path) {
                  var last = path[path.length-1];
                  if (!visitedNodesIds.hasOwnProperty(last.id)) {
                    array.forEach(path, lang.hitch(this, function(object, i) {
                      if (i>0) {
                        var n = tnode.tree.getNodeFromItem(object.id);
                        domStyle.set(n.rowNode, {
                          "background-color": "#A5C0DE"
                        });
                        if (visitedNodesIds.hasOwnProperty(object.id)) {
                          visitedNodesIds[object.id] = visitedNodesIds[object.id] + 1;
                        }
                        else {
                          visitedNodesIds[object.id] = 1;
                        }
                      }
                    }));
                  }

                }));*/
                // create attribute table for this layer
                /*attributeTable = new attributeTableWidget({
                  url: serviceLayer.url+'/'+tnode.item.visibilityId,
                  name: tnode.item.name,
                  where: null,
                  map: mapa
                });*/
              }
              else {
                /*if ((!attributeTable.tableDestroyed) && (attributeTable.featureTable)){
                  attributeTable.featureTable.destroy();
                  attributeTable.tabContainer.removeChild(attributeTable.tabPane);
                  attributeTable.tabPane.destroy();
                  attributeTable.tableDestroyed = true;
                }*/

                // hide sublayer
                var index = visible.indexOf(tnode.item.visibilityId);
                if (index > -1) {
                  visible.splice(index, 1);
                  serviceLayer.setVisibleLayers(visible);

                  // remove sublayer for identify task
                  identify.params.layerIds.splice(index, 1);

                  /*array.forEach(tnode.tree.path, lang.hitch(this, function(object, i){
                    if (i>0) {
                        var n = tnode.tree.getNodeFromItem(object.id);
                        if (visitedNodesIds[object.id] == 1) {
                          delete visitedNodesIds[object.id];
                          domStyle.set(n.rowNode, {
                            "background-color": ""
                          });
                        }
                        else if (visitedNodesIds[object.id] > 1) {
                          visitedNodesIds[object.id] = visitedNodesIds[object.id] - 1;
                        }
                    }
                  }));*/
                }

                // hide legend
                domStyle.set(legendContainerDiv, "display", "none");
              }
            });
            tnode.checkBox = cb;

            on(metadataButton, "click", function(){
              var metadataBaseURL = "http://metadata.helcom.fi/geonetwork/srv/eng/catalog.search#/metadata/";
          	  window.open(metadataBaseURL + that.metadata[tnode.item.code], '_blank');
            });
          }
          return tnode;
        }
      });
      //this.tree.placeAt(this.layerListTree);
			this.tree.placeAt(dojo.byId("layerListTreeID"));
      this.tree.startup();
    }
	});
});
