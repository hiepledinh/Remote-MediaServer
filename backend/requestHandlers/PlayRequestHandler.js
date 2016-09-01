/**
 * Created by owenray on 08-04-16.
 */
"use strict";
var spawn = require('child_process').spawn;
var os = require('os');
var fs = require("fs");
var Settings = require("../Settings");
var FFProbe = require("../FFProbe");
var Database = require("../Database");

var RequestHandler = require("./RequestHandler");

class PlayRequestHandler extends RequestHandler{
    handleRequest()
    {
        this.bufferedChuncks = 0;
        var parts = this.request.url.split("/");
        this.offset = parts.pop();
        //this.file = Settings.getValue("moviesFolder")+"/"+decodeURI(parts.join("/"));
        var mediaItem = Database.getById("media-item", parts.pop());
        var libraries = Settings.getValue("libraries");
        var library;
        if(!mediaItem)
        {
            return this.response.end();
        }
        for(var key in libraries)
        {
            if(libraries[key].uuid==mediaItem.attributes.libraryId)
            {
                library = libraries[key];
            }
        }
        console.log(library);
        this.file = library.folder+"/"+mediaItem.attributes.filepath;
        console.log(this.file);
        FFProbe.getInfo(this.file).then(this.gotInfo.bind(this), this.onError.bind(this));
    }

    gotInfo(info)
    {
        if(!info||!info.format)
        {
            console.log("VIDEO ERROR!");
            this.response.end();
            return;
        }
        this.response.setHeader('Content-Type', "video/mp4");
        this.response.setHeader('Accept-Ranges', 'none');
        var vCodec = "libx264";
        var aCodec = "aac";

        var supportedVideoCodecs = {"h264":1};
        var supportedAudioCodecs = {"aac":1};


        for(var key in info.streams)
        {
            var stream = info.streams[key];
            if(stream.codec_type=="video"&&supportedVideoCodecs[stream.codec_name])
            {
                vCodec = "copy";
            }
            if(stream.codec_type=="audio"&&supportedAudioCodecs[stream.codec_name])
            {
                aCodec = "copy";
            }
        }
        //console.log()
        var duration = Math.round((info.format.duration-this.offset)*1000);
        console.log("setDuration", duration);
        //OK... this is a hack to specify the video duration...
        this.tmpFile = os.tmpdir()+"/"+Math.random()+".txt";
        var metadata = ";FFMETADATA1\n"+
                        "[CHAPTER]\n"+
                        "TIMEBASE=1/1000\n"+
                        //"START=0\n"+
                        "END="+duration+"\n"+
                        "title=chapter \#1\n";

        fs.writeFileSync(this.tmpFile, metadata);

        var args = [
            //"-re", // <-- should read the file at running speed... but a little to slow...
            "-probesize", "50000000",
            "-thread_queue_size", "1024",
            "-ss", this.offset,
            "-i", this.file,
            "-i", this.tmpFile,
            "-ss", 0,
            "-map_metadata", "1",
            //"-af", "aresample=60000",
            //"-keyint_min", "60", "-g", "60",
            //"-r", "25",

            "-f", "mp4",
            "-vcodec", vCodec,
            "-movflags", "empty_moov",
            "-acodec", aCodec,
            //"-metadata:c:0", 'end=120000',
            "-strict", "-2",
            "-"
        ];
        console.log(Settings.getValue("ffmpeg_binary")+" "+args.join(" "));
        var proc = spawn(
            Settings.getValue("ffmpeg_binary"),
            args);
        this.proc = proc;

        proc.stdout.on('data', this.onData.bind(this));
        proc.stderr.on('data', this.onError.bind(this));
        proc.on('close', this.onClose.bind(this))
        proc.on('drain', function(){
            console.log("resume");
            proc.stdout.resume();
        });
        this.request.connection.on('close',function(){
            console.log("close!");
            proc.kill("SIGINT");
        });
    }


    onData(data) {
        this.bufferedChuncks++;
        if(this.bufferedChuncks>20)
        {
            console.log("pause!!");
            this.proc.stdout.pause();
        }
        this.response.write(data, function () {
            this.bufferedChuncks--;
            console.log("resume!!"+this.bufferedChuncks);
            this.proc.stdout.resume();
        }.bind(this));
    }

    onError(data)
    {
        console.log(`${data}`);
    }

    onClose(code)
    {
        console.log("Close:"+code, this.tmpFile);
        fs.unlink(this.tmpFile);

        //this.response.end();
    }
}

module.exports = PlayRequestHandler;
