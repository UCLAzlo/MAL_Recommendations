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

// Request-Promises and Rate Limiting
const rp = require("request-promise-native");
const RateLimiter = require("request-rate-limiter");
const limiter = new RateLimiter({
    rate: 10,
    interval: 40,
    backoffCode: 429,
    backoffTime: 5,
    maxWaitingTime: 12000
});

// body parser
const bodyParser = require("body-parser");
app.use(bodyParser.json());

// Postgres
const Pool = require("pg").Pool;

// Env parameters
const dotenv = require("dotenv");
dotenv.config();

// Port
let port = process.env.PORT || 34567;

const pool = new Pool({
    user: "admin",
    host: "localhost",
    database: "animeDB",
    password: process.env.DATABASE_PASSWD,
    port: 5432
});

//
// Create Tables to initialize
//
const createTables = () => {
    const queryText = `CREATE TABLE IF NOT EXISTS
        userList(
        username VARCHAR(64) NOT NULL,
        list JSONB NOT NULL
    )`;

    pool.query(queryText)
        .then(res => {
            console.log(res);
        })
        .catch(err => {
            console.log(err);
        });
};

//
// Drop all tables
//
const dropTables = () => {
    const queryText = "DROP TABLE IF EXISTS userList";
    pool.query(queryText)
        .then(res => {
            console.log(res);
        })
        .catch(err => {
            console.log(err);
        });
};

//
// Use Jikan API to retrieve user anime list
//
const retrieveUserAnimeList = user => {
    let options = {
        uri: "https://api.jikan.moe/v3/user/" + user + "/animelist/completed",
        json: true
    };
    limiter
        .request(options)
        .then(list => {
            let allAnime = [];
            list.body.anime.forEach(anime => {
                allAnime.push({
                    mal_id: anime.mal_id,
                    score: anime.score,
                    title: anime.title
                });
            });
            animeJSON = JSON.stringify(allAnime);
            const queryText = `INSERT INTO userlist
                VALUES ($1, $2);`;
            const values = ["user", animeJSON];
            // VALUES ('${user}', '${animeJSON}');`;
            return pool.query(queryText, values);
        })
        .then(res => {
            console.log(res);
        })
        .catch(err => {
            console.log(err);
        });
};

dropTables();
setTimeout(() => {
    createTables();
    retrieveUserAnimeList("ulazlo");
}, 200);
