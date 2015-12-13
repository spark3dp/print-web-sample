'use strict';

var Client = ADSKSpark.Client;
var Modal = ReactBootstrap.Modal;

var Dialog = React.createClass({
    propTypes: {
        isLoggedIn: React.PropTypes.bool.isRequired
    },

    getDefaultProps: function () {
        return {isLoggedIn: false};
    },

    render: function () {
        if (this.props.isLoggedIn) {
            return null;
        }

        // TODO: if there's an expired token, try to refresh instead of putting up login again

        return (
            <Modal show onHide={function () {}} dialogClassName="ADSKSpark-Login">
                <Modal.Body>
                    <div>
                        <iframe className="ADSKSpark-Login-iframe" src={Client.getLoginRedirectUrl(false, true)}/>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
});

module.exports = Dialog;
