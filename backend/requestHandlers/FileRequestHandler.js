/**
 * Created by owenray on 08-04-16.
 */
"use strict";

var fs = require('fs');
var mime = require('mime');
var path = require('path');

var RequestHandler = require("./RequestHandler");

class FileRequestHandler extends RequestHandler{
    handleRequest()
    {
        //this.response.end("ok");
        var url = this.request.url;
        var dir = __dirname+"/../../frontend/dist/";
        if(! url || url[url.length-1] === "/" || ! fs.existsSync(dir + url)) {
            if(!url.indexOf("?")&&path.parse(dir+url).ext)
            {
                return this.returnFourOFour();
            }
            url = "/index.html";
        }

        this.serveFile(dir+url);
    }

    serveFile(filename) {
        console.log(this.response.headersSent);
        this.response.setHeader('Content-Type', mime.lookup(filename));
        console.log(mime.lookup(filename));
        fs.readFile(filename, this.fileRead.bind(this));
    }

    returnFourOFour()
    {
        this.response.statusCode = "404";
        this.response.end("File not found.");
    }

    fileRead(err, data)
    {
        if(err)
        {
            console.log("404!");
            return this.returnFourOFour();
        }
        //if(data.length<9999)
        //    console.log('file served', `${data}`);
        console.log('file returned');
        this.response.end(data);
    }
}

//export RequestHandler;
module.exports = FileRequestHandler;
