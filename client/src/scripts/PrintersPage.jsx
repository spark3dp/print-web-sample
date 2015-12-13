'use strict';

var PrintManager = require('./PrintManagerStore.js');
var Status = require('./SparkStatus.js');

var Button = ReactBootstrap.Button;
var ButtonToolbar = ReactBootstrap.ButtonToolbar;
var Col = ReactBootstrap.Col;
var Grid = ReactBootstrap.Grid;
var Navbar = ReactBootstrap.Navbar;
var Row = ReactBootstrap.Row;

var PrinterJobDetails = React.createClass({
    onPauseClicked: function () {
        var printer = this.props.printer;
        PrintManager.Actions.pauseJob.triggerPromise(printer)
            .then(function () {
                Status.MessageAction.success('Printer \"' + printer.printer_name + '\" job paused');
            }).catch(function (error) {
                var message = error.statusText || ('Unable to pause job on \"' + printer.printer_name + '\"');
                Status.MessageAction.error(message);
            });
    },

    onResumeClicked: function () {
        var printer = this.props.printer;
        PrintManager.Actions.resumeJob.triggerPromise(printer)
            .then(function () {
                Status.MessageAction.success('Printer \"' + printer.printer_name + '\" job resumed');
            }).catch(function (error) {
                var message = error.statusText || ('Unable to resume job on  \"' + printer.printer_name + '\"');
                Status.MessageAction.error(message);
            });
    },

    onCancelClicked: function () {
        var printer = this.props.printer;

        bootbox.dialog({
            title: 'Cancel Job',
            message: 'Are you sure you want to cancel this job on' + printer.printer_name + '\"?',
            buttons: {
                no: {
                    label: 'No',
                    className: 'btn-default'
                },
                yes: {
                    label: 'Yes, Cancel',
                    className: 'btn-danger',
                    callback: function () {
                        PrintManager.Actions.cancelJob.triggerPromise(printer)
                            .then(function () {
                                Status.MessageAction.success('Printer \"' + printer.printer_name + '\" job canceled');
                            }).catch(function (error) {
                                var message = error.statusText || ('Unable to cancel job on  \"' + printer.printer_name + '\"');
                                Status.MessageAction.error(message);
                            });
                    }
                }
            }
        });
    },

    render: function () {
        var jobName = this.props.jobName;
        var timeRemaining = this.props.timeRemaining;
        var timer = moment.duration(timeRemaining,'s').format('hh:mm:ss');
        var completion = moment().add(timeRemaining, 's').calendar();
        var members = this.props.members;
        var jobMemberId = this.props.jobMemberId;
        var jobMemberName = members[jobMemberId] ? members[jobMemberId].name : null;
        var temperature = this.props.temperature;
        var printerStatus = this.props.printerStatus;
        var printerJobControlDisplay = (printerStatus === 'paused') ? 'Resume' : 'Pause';
        var printerJobControlFunction = (printerJobControlDisplay === 'Pause') ? this.onPauseClicked : this.onResumeClicked;

        return (
            <div className="PrinterJobDetails">
                <Row>
                    <Col md={10} mdOffset={1} className="job-details">
                        <Col md={3} className="center-block">
                            <h4>{jobName}</h4>
                            <h5> Print by: {jobMemberName}</h5>
                        </Col>
                        <Col md={4} className="center-block">
                            <h4 className="text-center">
                                {timer}
                            </h4>
                            <h5 className="text-center">
                                Completion: {completion}
                            </h5>
                        </Col>
                        <Col md={4} mdOffset={1}>
                            <ButtonToolbar>
                                <Button className="btn-print-studio pull-left" onClick={printerJobControlFunction}>
                                    {printerJobControlDisplay}
                                </Button>
                                <Button className="btn-print-studio pull-right" onClick={this.onCancelClicked}>
                                    Cancel
                                </Button>
                            </ButtonToolbar>
                            <h5 className="text-center">
                                Temperature: {temperature}&deg;C</h5>
                        </Col>
                    </Col>
                </Row>
            </div>
        );
    }
});

var RadialProgressBar = React.createClass({
    getDefaultProps: function () {
        return {
            strokeWidth: 9,
            trailWidth: 9,
            percent: null,
            status: 'ready',
            emptyStateImage: null,
            dimensions: {
                'width': '98px',
                'height': '98px'
            }
        }
    },
    render: function () {

        var strokeWidth = this.props.strokeWidth;
        var trailWidth = this.props.trailWidth;
        var percent = this.props.percent;
        var emptyStateImage = this.props.emptyStateImage;

        var radius = (40 - strokeWidth / 2);
        var radString = radius.toString();

        var pathString =
            'M 50, 50 ' +
            'm 0, -' + radString + ' ' +
            'a ' + radString + ',' + radString + ' 0 1 1 0, ' + (2 * radius).toString() + ' ' +
            'a ' + radString + ',' + radString + ' 0 1 1 0, -' + (2 * radius).toString();

        var len = Math.PI * 2 * radius;
        var lenString = len.toString();
        var pathStyle = {
            'strokeDasharray': lenString + 'px ' + lenString + 'px',
            'strokeDashoffset': ((100 - percent) / 100 * len).toString() + 'px',
            'transition': 'stroke-dashoffset 0.6s ease 0s, stroke 0.6s ease'
        };

        var circleMeasurements = this.props.dimensions;

        var showProgress = (this.props.status !== 'ready' && this.props.percent !== null);
        var percentDisplay = (percent !== null && showProgress) ? percent.toString() + '%' : null;
        return (
            <div className="RadialProgressBar" style={circleMeasurements}>
                {!showProgress ? <img className="icon-printer-50x50" src={emptyStateImage}/> : null}
                <svg viewBox='0 0 100 100'>
                    <circle cx="50" cy="50" r={radius} fill="white"/>
                    <text x="35" y="55" textAnchor="middle">{percentDisplay}</text>
                    <path className="trail" d={pathString} strokeWidth={trailWidth} fillOpacity='0'/>
                    {showProgress ? <path className="path" d={pathString} strokeLinecap='butt' strokeWidth={strokeWidth}
                                          fillOpacity='0' style={pathStyle}/> : null}
                </svg>
            </div>
        );
    }
});

var PrinterListEntry = React.createClass({
    onDeleteClicked: function () {
        var printer = this.props.printer;
        bootbox.dialog({
            title: 'Delete Printer',
            message: 'Are you sure you want to delete \"' + printer.printer_name + '\"?',
            buttons: {
                no: {
                    label: 'No',
                    className: 'btn-default'
                },
                yes: {
                    label: 'Yes, Delete',
                    className: 'btn-danger',
                    callback: function () {
                        PrintManager.Actions.deletePrinter.triggerPromise(printer)
                            .then(function () {
                                Status.MessageAction.success('Printer \"' + printer.printer_name + '\" deleted');
                            }).catch(function (error) {
                                var message = error.statusText || ('Unable to delete \"' + printer.printer_name + '\"');
                                Status.MessageAction.error(message);
                            });
                    }
                }
            }
        });
    },
    onResetClicked: function () {
        var printer = this.props.printer;
        bootbox.dialog({
            title: 'Reset Printer',
            message: 'Are you sure you want to reset \"' + printer.printer_name + '\"?',
            buttons: {
                no: {
                    label: 'No',
                    className: 'btn-default'
                },
                yes: {
                    label: 'Yes, Reset',
                    className: 'btn-danger',
                    callback: function () {
                        PrintManager.Actions.resetPrinter.triggerPromise(printer)
                            .then(function () {
                                Status.MessageAction.success('Printer \"' + printer.printer_name + '\" reset');
                            }).catch(function (error) {
                                var message = error.statusText || ('Unable to reset \"' + printer.printer_name + '\"');
                                Status.MessageAction.error(message);
                            });
                    }
                }
            }
        });
    },
    getInitialState: function() {
        return {showDetails: false}
    },
    toggleJobShow: function () {
        var curState = this.state.showDetails;
        this.setState({showDetails: !curState});
    },
    render: function () {
        var printer = this.props.printer;
        var printerType = PrintManager.Store.state.printerTypes[printer.type_id];
        var printerIcon = printerType.icons['50x50_id'];

        var ownerName = this.props.ownerName;
        var members = this.props.members;

        var state = (this.props.status || {}).last_reported_state;
        var data = (state || {}).data;
        var status = (state ? state.printer_status : '') || (data ? data.job_status : '');

        if (printerType && printerType.id === '7FAF097F-DB2E-45DC-9395-A30210E789AA' && data) {
            if (data.state) {
                status += ' state=' + data.state;
            }
            if (data.ui_sub_state && data.ui_sub_state !== 'NoUISubState') {
                status += ' ui_sub_state=' + data.ui_sub_state;
            }
        }

        var error, temp = null, remaining = null, percent = null;
        if (data && data.job_id) {
            temp = data.temperature || data.temprature;
            remaining = data.seconds_left;
            percent = (data.layer / data.total_layers) * 100;
        }

        if (data && data.is_error) {
            error = <div className="printer-error">{data.error_message}</div>;
        }

        //printer job details props
        var printerId = null, jobMemberId = null, jobName = null, jobId = null;
        if (typeof this.props.job !== 'undefined') {
            printerId = this.props.job.printer_id;
            jobMemberId = this.props.job.member_id;
            jobName = (this.props.job.job_name !== null) ? this.props.job.job_name : this.props.job.job_id;
            jobId = this.props.job.job_id;
        }

        var printerHasJob = jobId !== null;
        var printerStatus = state ? state.printer_status : null;
        return (
            <div className="PrinterListEntry">
                <Row>
                    <Col md={1} className="radial-progress-container">
                        <RadialProgressBar percent={percent} status={printerStatus} emptyStateImage={printerIcon}/>
                    </Col>
                    <Col md={3}>
                        <h5 className="text-justify">{ownerName}</h5>

                        <h2 className="text-justify">{printer.name}</h2>
                    </Col>
                    <Col md={3}>
                        <h4>Status: {printerStatus}</h4>
                    </Col>
                    <Col md={4}>
                        <ButtonToolbar>
                            <Button className="btn-print-studio btn-print-studio--dark pull-left" onClick={this.onDeleteClicked}>
                                Delete Printer
                            </Button>
                            <Button className="btn-print-studio btn-print-studio--dark pull-right" onClick={this.onResetClicked}>
                                Reset Printer
                            </Button>
                        </ButtonToolbar>
                    </Col>
                    <Col md={1} className="dropdown-container">
                        <Button className="btn-dropdown" bsSize="small" onClick={this.toggleJobShow}>
                            {(printerHasJob) ? (this.state.showDetails) ? 'v' : '>' : null}
                        </Button>
                    </Col>
                </Row>
                {this.state.showDetails ?
                    <PrinterJobDetails key={jobId} jobName={jobName} timeRemaining={remaining} jobMemberId={jobMemberId}
                                       printerId={printerId} temperature={temp} members={members} printer={printer}
                                       printerStatus={printerStatus}
                        /> : null}
                {error}
            </div>
        );
    }
});

var PrintersList = React.createClass({
    render: function () {
        var printerData = PrintManager.Store.getPrinterData();
        var members = this.props.members;
        var parts = printerData.map(function (datum) {
            var printer = datum.printer;
            var owner = members[datum.owner.member_id];
            var ownerName = owner ? (owner.name + '\'s ') : '';
            var job = datum.job;

            return (
                <PrinterListEntry key={printer.printer_id} printer={printer}
                           status={datum.status} ownerName={ownerName}
                           members={members} job={job}/>
            );
        });

        var noPrintersMessage = null;
        if (printerData.length === 0) {
            noPrintersMessage =
                <div>
                    <h3>To register a printer make sure it's turned on and online.</h3>
                    <h3>Check your printer display to obtain a printer code or generate
                        one by adding a printer from Print Studio Desktop</h3>
                </div>
        }

        return (
            <div className="PrintersList">
                {parts}
                {noPrintersMessage}
            </div>
        );
    }
});

var Page = React.createClass({
    mixins: [Reflux.connect(PrintManager.Store)],
    onRegisterClicked: function () {
        var elemName = this.refs.name;
        var elemCode = this.refs.code;
        var name = elemName.value;
        var code = elemCode.value;

        PrintManager.Actions.registerPrinter.triggerPromise(name, code)
            .then(function () {
                Status.MessageAction.success('Printer \"' + name + '\" registered');
                elemName.value = '';
                elemCode.value = '';
            }).catch(function (error) {
                var message = error.statusText || ('Unable to register \"' + name + '\"');
                Status.MessageAction.error(message);
            });
    },

    onRefreshClicked: function () {
        PrintManager.Actions.refresh();
    },

    componentDidMount: function () {
        var printerName = this.props.printerName;
        var registrationCode = this.props.registrationCode;
        if (printerName && registrationCode) {
            var elemName = this.refs.name;
            var elemCode = this.refs.code;
            elemName.value = printerName;
            elemCode.value = registrationCode;
        }
    },

    render: function () {
        return (
            <div className="PrintersPage">
                <Grid>
                    <Row>
                        <Col md={3} mdOffset={8}>
                            <span className="pull-right">
                                <a role="button" className="btn btn-print-studio btn-print-studio--dark refresh" type="button"
                                    onClick={this.onRefreshClicked}>Refresh</a>
                            </span>
                        </Col>
                    </Row>
                    <PrintersList members={this.state.members}/>
                    <Navbar className="PrinterRegistrationFooter" fixedBottom={true}>
                        <Row>
                            <h3 className="text-center">Register a printer</h3>
                        </Row>
                        <Row>
                            <Col md={3} mdOffset={2}>
                                <label htmlFor="printer-name">Nickname your printer</label>
                                <input type="text" className="form-control" id="printer-name" ref="name"
                                       placeholder="Nickname"/>
                            </Col>
                            <Col md={3}>
                                <label htmlFor="printer-token">Enter printer code</label>
                                <input type="text" className="form-control pull-left" id="printer-token" ref="code"
                                       placeholder="ABCDEF"/>
                            </Col>
                            <Col md={2}>
                                <a role="button" className="btn btn-default btn-print-studio"
                                   onClick={this.onRegisterClicked}>Register Printer</a>
                            </Col>
                        </Row>
                    </Navbar>
                </Grid>
            </div>
        );
    }
});

module.exports = Page;
