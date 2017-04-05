/*global location */
sap.ui.define([
		"sap/ui/demo/masterdetail/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"jquery.sap.global",
		"sap/ui/model/Filter",
		"sap/ui/demo/masterdetail/model/formatter"
	], function (BaseController, JSONModel,jQuery,Filter, formatter) {
		"use strict";

		return BaseController.extend("sap.ui.demo.masterdetail.controller.Detail", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			onInit : function () {
				// Model used to manipulate control states. The chosen values make sure,
				// detail page is busy indication immediately so there is no break in
				// between the busy indication for loading the view's meta data

				this._oTable = this.byId("lineItemsList");
				var oViewModel = new JSONModel({
					busy : false,
					delay : 0,
					lineItemListTitle : this.getResourceBundle().getText("detailLineItemTableHeading")
				});

				this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

				this.setModel(oViewModel, "detailView");

				this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));

			/*	this.oReadOnlyTemplate = this._oTable.removeItem(0);
				// this.rebindTable(this.oReadOnlyTemplate, "Navigation");
				this.oEditableTemplate = new sap.m.ColumnListItem({
					cells: [
						new sap.m.Input({
							value: "{Name}"
						}), new sap.m.Input({
							value: "{Quantity}",
							description: "{UoM}"
						}), new sap.m.Input({
							value: "{WeightMeasure}",
							description: "{WeightUnit}"
						}), new sap.m.Input({
							value: "{Price}",
							description: "{CurrencyCode}"
						})
					]
				});*/

			},


			/*rebindTable: function(oTemplate, sKeyboardMode) {
				this.oTable.bindItems({
					path: "/ProductCollection",
					template: oTemplate,
					key: "ProductId"
				}).setKeyboardMode(sKeyboardMode);
			},*/
			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * Event handler when the share by E-Mail button has been clicked
			 * @public
			 */
			onShareEmailPress : function () {
				var oViewModel = this.getModel("detailView");

				sap.m.URLHelper.triggerEmail(
					null,
					oViewModel.getProperty("/shareSendEmailSubject"),
					oViewModel.getProperty("/shareSendEmailMessage")
				);
			},


			/**
			 * Updates the item count within the line item table's header
			 * @param {object} oEvent an event containing the total number of items in the list
			 * @private
			 */
			onListUpdateFinished : function (oEvent) {
				var sTitle,
					iTotalItems = oEvent.getParameter("total"),
					oViewModel = this.getModel("detailView");

				// only update the counter if the length is final
				if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
					if (iTotalItems) {
						sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
					} else {
						//Display 'Line Items' instead of 'Line items (0)'
						sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
					}
					oViewModel.setProperty("/lineItemListTitle", sTitle);
				}
			},

			/* =========================================================== */
			/* begin: internal methods                                     */
			/* =========================================================== */

			/**
			 * Binds the view to the object path and expands the aggregated line items.
			 * @function
			 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
			 * @private
			 */
			_onObjectMatched : function (oEvent) {
				var sObjectId =  oEvent.getParameter("arguments").objectId;
				this.getModel().metadataLoaded().then( function() {
					var sObjectPath = this.getModel().createKey("Objects", {
						ObjectID :  sObjectId
					});
					this._bindView("/" + sObjectPath);
				}.bind(this));
			},

			/**
			 * Binds the view to the object path. Makes sure that detail view displays
			 * a busy indicator while data for the corresponding element binding is loaded.
			 * @function
			 * @param {string} sObjectPath path to the object to be bound to the view.
			 * @private
			 */
			_bindView : function (sObjectPath) {
				// Set busy indicator during view binding
				var oViewModel = this.getModel("detailView");

				// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
				oViewModel.setProperty("/busy", false);

				this.getView().bindElement({
					path : sObjectPath,
					events: {
						change : this._onBindingChange.bind(this),
						dataRequested : function () {
							oViewModel.setProperty("/busy", true);
						},
						dataReceived: function () {
							oViewModel.setProperty("/busy", false);
						}
					}
				});
			},

			_onBindingChange : function () {
				var oView = this.getView(),
					oElementBinding = oView.getElementBinding();

				// No data for the binding
				if (!oElementBinding.getBoundContext()) {
					this.getRouter().getTargets().display("detailObjectNotFound");
					// if object could not be found, the selection in the master list
					// does not make sense anymore.
					this.getOwnerComponent().oListSelector.clearMasterListSelection();
					return;
				}

				var sPath = oElementBinding.getPath(),
					oResourceBundle = this.getResourceBundle(),
					oObject = oView.getModel().getObject(sPath),
					sObjectId = oObject.ObjectID,
					sObjectName = oObject.Name,
					oViewModel = this.getModel("detailView");

				this.getOwnerComponent().oListSelector.selectAListItem(sPath);

				oViewModel.setProperty("/shareSendEmailSubject",
					oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
				oViewModel.setProperty("/shareSendEmailMessage",
					oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
			},

			_onMetadataLoaded : function () {
				// Store original busy indicator delay for the detail view
				var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
					oViewModel = this.getModel("detailView"),
					oLineItemTable = this.byId("lineItemsList"),
					iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

				// Make sure busy indicator is displayed immediately when
				// detail view is displayed for the first time
				oViewModel.setProperty("/delay", 0);
				oViewModel.setProperty("/lineItemTableDelay", 0);

				oLineItemTable.attachEventOnce("updateFinished", function() {
					// Restore original busy indicator delay for line item table
					oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
				});

				// Binding the view will set it to not busy - so the view is always busy if it is not bound
				oViewModel.setProperty("/busy", true);
				// Restore original busy indicator delay for the detail view
				oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
			},

			//custom handlings
			handleIconTabBarSelect: function (oEvent) {
				var oBinding = this._oTable.getBinding("items"),
					sKey = oEvent.getParameter("key"),
					oFilter;

				if (sKey === "Open") {
					oFilter = new Filter("Status", sap.ui.model.FilterOperator.EQ, "Open");
					oBinding.filter([oFilter]);
				} else if (sKey === "In Process") {
					oFilter = new Filter("Status", sap.ui.model.FilterOperator.EQ, "In Process");
					oBinding.filter([oFilter]);
				} else if (sKey === "Shipped") {
					oFilter = new Filter("Status", sap.ui.model.FilterOperator.EQ, "Shipped");
					oBinding.filter([oFilter]);
				} else {
					oBinding.filter([]);
				}
			}

			/*onEdit: function() {
				this.aProductCollection = jQuery.extend(true, [], this.oModel.getProperty("/ProductCollection"));
				this.getView().byId("editButton").setVisible(false);
				this.getView().byId("saveButton").setVisible(true);
				this.getView().byId("cancelButton").setVisible(true);
				// this.rebindTable(this.oEditableTemplate, "Edit");
			},

			onSave: function() {
				this.getView().byId("saveButton").setVisible(false);
				this.getView().byId("cancelButton").setVisible(false);
				this.getView().byId("editButton").setVisible(true);
				this.rebindTable(this.oReadOnlyTemplate, "Navigation");
			},

			onCancel: function() {
				this.getView().byId("cancelButton").setVisible(false);
				this.getView().byId("saveButton").setVisible(false);
				this.getView().byId("editButton").setVisible(true);
				this.oModel.setProperty("/ProductCollection", this.aProductCollection);
				this.rebindTable(this.oReadOnlyTemplate, "Navigation");
			}*/
		});

	}
);
