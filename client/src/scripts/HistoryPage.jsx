'use strict';

var History = require('./HistoryStore.js');
var PrinterSelect = require('./PrinterSelectStore.js');
var utilities = require('./utilities.js');

var HistoryRow = React.createClass({
    render: function () {
        var job = this.props.job;

        var printer = PrinterSelect.Store.getPrinterFromId(job.printer_id);
        var printerName = printer ? printer.printer_name : '(unknown)';
        var jobStatus = job.status;
        var jobId = job.id;
        var jobDate = moment.utc(job.data.job_date_time, 'MMMM D, YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

        var temp, progress, remaining;
        var isPrinting = (jobStatus === 'printing' || jobStatus === 'paused');

        var data = job.data.job_status.data;
        if (isPrinting) {
            var s = utilities.formatJob({
                temp: data.temperature || data.temprature,
                current: data.layer,
                total: data.total_layers,
                remaining: data.seconds_left
            });

            temp = s.temp;
            progress = s.progress;
            remaining = s.remaining;
        }

        var info;
        if (isPrinting) {
            info = (
                <div>
                    <p>
                        {jobStatus}<br/>
                        {temp}<br/>
                        {progress}<br/>
                        {remaining}<br/>
                    </p>
                </div>
            );
        } else {
            info = (
                <div>
                    {jobStatus}
                </div>
            );
        }

        return (
            <tr>
                <td>{printerName}</td>
                <td>{info}</td>
                <td>{jobId}</td>
                <td>{jobDate}</td>
            </tr>
        );
    }
});

var Page = React.createClass({
    mixins: [Reflux.connect(History.Store)],

    onRefreshClicked: function () {
        History.Actions.refresh();
    },

    render: function () {
        var rows = this.state.jobs.map(function (job) {
            return <HistoryRow key={job.id} job={job}/>;
        });

        return (
            <div className="table-responsive">
                <table className="table table-striped table-bordered table-hover table-condensed">
                    <thead>
                    <tr>
                        <th>Printer</th>
                        <th>Status</th>
                        <th>id</th>
                        <th>Started</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows}
                    </tbody>
                </table>
                <button className="btn btn-default" type="button" onClick={this.onRefreshClicked}>Refresh</button>
            </div>
        );
    }
});

module.exports = Page;
