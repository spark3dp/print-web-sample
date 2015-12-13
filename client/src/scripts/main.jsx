'use strict';

var BroadcastEvents = require('./BroadcastEvents.js');
var Editor = require('./editor.jsx');
var HistoryPage = require('./HistoryPage.jsx');
var Login = require('./LoginStore.js');
var LoginDialog = require('./LoginDialog.jsx');
var Members = require('./MemberStore.js');
var PrintersPage = require('./PrintersPage.jsx');
var PrintManager = require('./PrintManagerStore.js');

var Nav = ReactBootstrap.Nav;
var Navbar = ReactBootstrap.Navbar;
var NavItem = ReactBootstrap.NavItem;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;
var Tooltip = ReactBootstrap.Tooltip;

var PAGE = {
    EDITOR: 0,
    PRINTERS: 1,
    HISTORY: 2
};

toastr.options = {
    newestOnTop: false,
    positionClass: 'toast-bottom-right'
};

var Header = React.createClass({
    onLogout: function () {
        Login.Actions.logout();
    },

    onClick: function (page) {
        this.props.onPageChange(page);
    },

    render: function () {
        var avatar = '';
        var name = '';
        var member = this.props.member;
        if (member) {
            avatar = member.profile.avatar_path;
            name = member.name;
        }

        var avatarDiv;
        if (avatar) {
            var tooltip = <Tooltip id={member.id}>Logout {name}</Tooltip>;

            avatarDiv = (
                <Nav navbar right className="nav-avatar">
                    <OverlayTrigger overlay={tooltip} delayShow={1000} delayHide={100}>
                        <img src={avatar} onClick={this.onLogout} className="ADSKSpark-avatar img-circle"/>
                    </OverlayTrigger>
                </Nav>
            );
        }
        return (
            <div className="navbar-parent">
                <Navbar brand="Spark Sample Application">
                    <Nav navbar left bsStyle="pills" activeKey={this.props.page}>
                        <NavItem eventKey={PAGE.EDITOR} onClick={this.onClick.bind(this, PAGE.EDITOR)}>Editor</NavItem>
                        <NavItem eventKey={PAGE.PRINTERS}
                                 onClick={this.onClick.bind(this, PAGE.PRINTERS)}>Printers</NavItem>
                        <NavItem eventKey={PAGE.HISTORY}
                                 onClick={this.onClick.bind(this, PAGE.HISTORY)}>History</NavItem>
                    </Nav>
                    {avatarDiv}
                </Navbar>
            </div>
        );
    }
});

var App = React.createClass({
    mixins: [
        Reflux.connect(Login.Store),
        Reflux.connect(Members.Store)],

    getInitialState: function () {
        return {page: PAGE.EDITOR};
    },

    onPageChange: function (page) {
        if (this.state.page !== page) {
            this.setState({page: page});

            if (page === PAGE.PRINTERS) {
                PrintManager.Actions.refresh();
            }
        }
    },

    componentDidMount: function () {

        // We switch the page here, as opposed to setting it in getInitialState() -
        // trying to do it that way caused problems with the WebCAD component.
        // However: setState() in componentDidMount() an anti-pattern?
        //
        if (this.props.printerName && this.props.registrationCode) {
            this.setState({page: PAGE.PRINTERS});
        }
    },

    render: function () {
        var that = this;

        function style(page) {
            return {display: (that.state.page === page) ? 'inline' : 'none'};
        }

        return (
            <div className="main">
                <Header member={this.state.member} page={this.state.page} onPageChange={this.onPageChange}/>
                <LoginDialog isLoggedIn={this.state.isLoggedIn}/>

                <div style={style(PAGE.EDITOR)} className="editorPage"><Editor/></div>
                <div style={style(PAGE.PRINTERS)}><PrintersPage printerName={this.props.printerName}
                                                                registrationCode={this.props.registrationCode}/>
                </div>
                <div style={style(PAGE.HISTORY)}><HistoryPage/></div>
            </div>
        );
    }
});

var BROADCAST_EVENT_AUTH_CALLBACK = 'auth_callback';

BroadcastEvents.events[BROADCAST_EVENT_AUTH_CALLBACK] = function () {
    Login.Actions.login();
};

BroadcastEvents.listen();

var urlParams = ADSKSpark.Helpers.extractParamsFromURL();
function decodeUrlParam(name) {
    var value = urlParams[name];
    if (value) {
        value = decodeURIComponent(value);
        return value.replace(/^[\/#]+/, '').replace(/[\/#]+$/, '');
    }
    return null;
}

if (urlParams.code) {
    ADSKSpark.Client.completeLogin(true)
        .then(function () {
            BroadcastEvents.emit(BROADCAST_EVENT_AUTH_CALLBACK);
        });
} else {
    var printerName = decodeUrlParam('printer-name');
    var registrationCode = decodeUrlParam('registration-code');

    $(document).ready(function () {
        var elem = document.getElementById('main');
        ReactDOM.render(<App printerName={printerName} registrationCode={registrationCode}/>, elem);
    });
}
