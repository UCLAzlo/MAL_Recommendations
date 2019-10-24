// Libraries required for server
// express
const express = require("express");
const app = express();
app.use(express.static("public"));

// handlebars
const handlebars = require("express-handlebars").create({
    defaultLayout: "main"
});
app.engine("handlebars", handlebars.engine);
app.set("view engine", "handlebars");

// body parser
const bodyParser = require("body-parser");
app.use(bodyParser.json());

//Postgres operations
const db = require("./dbOps");

//Mal operations and interact with DB
const mal = require("./malOps.js");

// Port
app.set("port", process.env.PORT || 34567);

//
// Resets Postgres table
//
app.get("/reset-table", function(req, res, next) {
    db.dropTableList()
        .then(resP => {
            db.dropTableAnime();
        })
        .then(resP => {
            db.createTableList();
        })
        .then(resP => {
            db.createTableAnime();
        })
        .then(resP => {
            res.status(200);
            res.send("Tables are reset");
        })
        .catch(err => {
            next(err);
        });
});

//
// Populate user
//
app.post("/userAnime", function(req, res, next) {
    mal.retrieveUserAnimeList(req.body.username)
        .then(resP => {
            return mal.populateAnimeDB(req.body.username);
        })
        .then(resP => {
            console.log("Sending response");
            res.status(200);
            res.send(req.body.username + " Anime Details Finished Adding");
        })
        .catch(err => {
            next(err);
        });
});

//
// Get user recs based on populated data
//
app.get("/userReqs", function(req, res, next) {
    recs = mal.getRecommendations(req.query.username);
    res.status(200);
    res.send(recs);
});

//
// Generic Error capture
//
app.use(function(err, req, res, next) {
    console.error(err);
    res.type("plain/text");
    res.status(500);
    res.send("500 - Server Error");
});

app.listen(app.get("port"), function() {
    console.log(
        "Server started on http://localhost:" +
            app.get("port") +
            "; press Ctrl-C to terminate."
    );
});
