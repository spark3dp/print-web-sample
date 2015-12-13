'use strict';

var PrinterSelect = require('./PrinterSelectStore.js');
var Settings = require('./SettingStore.js');

var Input = ReactBootstrap.Input;
var Modal = ReactBootstrap.Modal;

var Dialog = React.createClass({
    mixins: [
        Reflux.connect(PrinterSelect.Store),
        Reflux.connect(Settings.Store)
    ],

    getInitialState: function () {
        return {show: false};
    },

    show: function (show) {
        if (show === undefined) {
            show = true;
        }
        this.setState({show: show});
    },

    onClose: function () {
        this.show(false);
    },

    onProfileSelected: function () {
        Settings.Actions.selectProfile(this.refs.profile.getValue());
    },

    onMaterialSelected: function () {
        Settings.Actions.selectMaterial(this.refs.material.getValue());
    },

    onAutofitClicked: function () {
        Settings.Actions.autofit(this.refs.autofit.getChecked());
    },

    render: function () {
        if (!this.state.show) {
            return null;
        }

        var materials = Settings.Store.getMaterialsForSelectedPrinterType().map(function (material) {
            var id = material.id;
            return <option key={id} value={id}>{material.name}</option>;
        });

        var selectedMaterialIndex = Settings.Store.getSelectedMaterialIndex();

        var profiles = Settings.Store.getProfilesForSelectedPrinterType().map(function (profile) {
            var id = profile.id;
            return <option key={id} value={id}>{profile.name}</option>;
        });

        var selectedProfileIndex = Settings.Store.getSelectedProfileIndex();

        var settings = this.state.settings;
        var schema = Settings.Store.getSchema();
        var components = schema.filter(function (item) {
            return item.category;
        }).map(function (item) {
            var text = item.category + ': ' + item.user_name + '=' + settings[item.name];
            return <div key={item.name}>{text}</div>;
        });

        return (
            <Modal show={this.state.show} onHide={this.onClose}>
                <Modal.Header closeButton>
                    <Modal.Title>Settings</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <form>
                        <div className="form-group">
                            <Input ref="autofit" type="checkbox" onChange={this.onAutofitClicked}
                                   checked={this.state.autofit} label="Resize model to fit build volume"/>
                        </div>

                        <div className="form-group">
                            <label>Select material:</label>
                            <Input ref="material" type="select" onChange={this.onMaterialSelected}
                                   selectedIndex={selectedMaterialIndex}>
                                {materials}
                            </Input>
                        </div>

                        <div className="form-group">
                            <label>Select print profile:</label>
                            <Input ref="profile" type="select" onChange={this.onProfileSelected}
                                   selectedIndex={selectedProfileIndex}>
                                {profiles}
                            </Input>
                        </div>

                        <label>Advanced settings</label>

                        <div className="panel panel-default settings-advanced">
                            <div className="panel-body">
                                {components}
                            </div>
                        </div>
                    </form>
                </Modal.Body>
                <Modal.Footer>
                    <button className="btn btn-primary" type="button" onClick={this.onClose}>OK</button>
                </Modal.Footer>
            </Modal>
        );
    }
});

module.exports = Dialog;
