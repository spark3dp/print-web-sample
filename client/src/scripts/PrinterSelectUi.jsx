'use strict';

var PrinterSelect = require('./PrinterSelectStore.js');

var Modal = ReactBootstrap.Modal;

var Dialog = React.createClass({
    mixins: [Reflux.connect(PrinterSelect.Store)],

    getInitialState: function () {
        return {show: false};
    },

    show: function (show) {
        if (show === undefined) {
            show = true;
        }
        if (show) {
            PrinterSelect.Actions.refresh();
        }
        this.setState({show: show});
    },

    onClose: function () {
        this.show(false);
    },

    onPrinterClicked: function (event) {
        var id = parseInt(event.currentTarget.dataset.id, 10);
        PrinterSelect.Actions.selectPrinter(id);
    },

    onPrinterTypeClicked: function (event) {
        var id = event.currentTarget.dataset.id;
        PrinterSelect.Actions.selectPrinterType(id);
    },

    render: function () {
        if (!this.state.show) {
            return null;
        }

        var printersUi;

        if (this.state.printers.length) {
            var selectedPrinter = this.state.printer;
            var selectedPrinterId = selectedPrinter ? selectedPrinter.id : null;
            var printers = this.state.printers.map(function (printer) {
                var id = printer.printer_id;
                var active = (id === selectedPrinterId);
                id = String(id);
                var printerType = PrinterSelect.Store.getPrinterTypeFromPrinter(printer);
                var header = printerType.manufacturer + ' ' + printerType.name;
                return (
                    <div className={classNames('list-group-item', {active: active})} key={id} data-id={id}
                         onClick={this.onPrinterClicked}>
                        <img src={printerType.icons['50x50_id']}/>

                        <div>{header}</div>
                        <div>{printer.printer_name}</div>
                    </div>
                );
            }.bind(this));

            printersUi = (
                <div>
                    <div>Select printer:</div>
                    <div className="printer-select-list">
                        {printers}
                    </div>
                </div>
            );

        } else {
            printersUi = (
                <div>
                    <div>No printers available</div>
                </div>
            );
        }

        var printerTypesUi;

        if (this.state.printerTypes.length) {
            var selectedPrinterTypeId = PrinterSelect.Store.getSelectedPrinterTypeId();
            var printerTypes = this.state.printerTypes.map(function (printerType) {
                var id = printerType.id;
                var active = (printerType.id === selectedPrinterTypeId);
                var header = printerType.manufacturer + ' ' + printerType.name;
                return (
                    <div className={classNames('list-group-item', {active: active})} key={id} data-id={id}
                         onClick={this.onPrinterTypeClicked}>
                        <img src={printerType.icons['50x50_id']}/>

                        <div>{header}</div>
                        <div>Printer Type</div>
                    </div>
                );
            }.bind(this));

            var title = this.state.printers.length ? 'Or select printer type:' : 'Select printer type:';

            printerTypesUi = (
                <div>
                    <div>{title}</div>
                    <div className="printer-select-list">
                        {printerTypes}
                    </div>
                </div>
            );

        } else {
            printerTypesUi = (
                <div>
                    <div>No printer types available</div>
                </div>
            );
        }

        return (
            <Modal show={this.state.show} onHide={this.onClose} dialogClassName="printer-select-dialog">
                <Modal.Body>
                    <div>
                        {printersUi}
                        {printerTypesUi}
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
});

module.exports = Dialog;
