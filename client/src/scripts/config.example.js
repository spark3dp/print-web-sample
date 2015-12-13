/*
 config.example.js / config.js
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

 This file contains information specific for your application.
 It should include your app key which you should copy from your app's page in
 the Spark Developer Portal (https://spark.autodesk.com/developers/myApps) and your authentication server endpoints

 In order for the system to work, you must copy this file from config.example.js
 to config.js - it will be automatically excluded from the version control thanks to git settings.
 */

'use strict';

module.exports = {
    APP_KEY: '',
    AUTH_SERVER_URL_BASE: 'http://localhost:3000',
    GUEST_TOKEN_URL: '/guest_token',
    ACCESS_TOKEN_URL: '/access_token',
    REFRESH_TOKEN_URL: '/refresh_token',
    PRODUCTION: false
};