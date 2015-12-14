## print-web-sample

This sample web application demonstrates an end-to-end 3D printing workflow using the Spark APIs. It takes the user through the necessary steps required to import, heal, position, support, slice, export and print a 3D model.

### Setup

It requires app credentials which you may obtain through the [Spark Developer Portal](https://spark.autodesk.com/developers/getStarted).

You'll need [Node.js](https://nodejs.org) and [npm](https://www.npmjs.com/) (node package manager) installed.
This build has been tested with Node [v0.12.7](https://nodejs.org/dist/v0.12.7/).

Next, you'll need [bower](http://bower.io) (another package manager, for the front-end) 
and [gulp](http://gulpjs.com/) (a task/build runner) installed globally.
Depending on how your system is configured, the following commands might need to be run using sudo.

```shell
npm install -g bower
npm install -g gulp
```

### Server

This sample requires authentication in order to perform API calls to Spark.

This Node.js server provides authentication. It is copied from the [spark-js-sdk](https://github.com/spark3dp/spark-js-sdk) authentication_server sample.

This server implements the following [Spark OAuth2.0](https://spark.autodesk.com/developers/reference/authentication) endpoints:

* Access token callback endpoint - `/access_token`
* Guest token callback endpoint - `/guest_token`
* Refresh token callback endpoint - `/refresh_token`


####To run the server

* Copy `server/config.example.js` to `server/config.js` and enter your [app key and app secret](https://spark.autodesk.com/developers/myApps). 
* Run:
```sh
$ cd server
$ npm install
$ node server.js
```

You now have a server running on your machine with the access, guest and refresh token endpoints.


### Client
First copy the file `src/scripts/config.example.js` to `src/scripts/config.js` and enter your [app key](https://spark.autodesk.com/developers/myApps). 

If you modified the server that comes with this repository, you have the option to change the `AUTH_SERVER_URL_BASE` to something different than localhost:3000.

Now, install the dependencies:

```shell
cd client
npm install
```

To build it execute `gulp` on the command-line (aliases are `gulp build` and `gulp build:debug`).
To create a minified build use `gulp dist` or `gulp build:release`.

To debug the application, execute `gulp serve` on the command-line. This will open `http://localhost.autodesk.com:8000`
in your default browser. When you change source files, the application will be automatically
rebuilt and reloaded in the browser.

To run a debug or release build after you've built it, you can do one of the following:

```shell
cd client/build
python -m SimpleHTTPServer
```

or

```shell
npm install -g http-server
cd client/build
http-server -p 8000 -d False
```

and go to `http://localhost.autodesk.com:8000` in your browser.

The client uses [ReactJS](https://facebook.github.io/react/) and [RefluxJS](https://github.com/reflux/refluxjs).
It uses [Browserify](http://browserify.org/) to bundle dependencies.
It uses [Less](http://lesscss.org/) and [Bootstrap](https://getbootstrap.com/)
(including [React-Bootstrap](https://react-bootstrap.github.io/)) for styling.
