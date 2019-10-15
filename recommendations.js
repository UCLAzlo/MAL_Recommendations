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
// Rate-Limiting set to abide by MAL and Jikan Limits
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

//Postgres operations
const db = require("./dbOps");

// Port
let port = process.env.PORT || 34567;

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
            return db.insertList(user, animeJSON);
        })
        .then(res => {
            console.log(res);
            // populateAnimeDB(user);
        })
        .catch(err => {
            console.log(err);
        });
};

const populateAnimeDB = user => {
    db.selectUserAnime(user)
        .then(res => {
            let animeList = res.rows[0].list;
            animeList.forEach(anime => {
                let options = {
                    uri: "https://api.jikan.moe/v3/anime/" + anime.mal_id,
                    json: true
                };
                limiter
                    .request(options)
                    .then(animeDetails => {
                        let animeObject = {};
                        animeObject["id"] = animeDetails.body.mal_id;
                        animeObject["title"] = animeDetails.body.title;
                        animeObject["score"] = animeDetails.body.score;
                        animeObject["popularity"] =
                            animeDetails.body.popularity;
                        animeObject["members"] = animeDetails.body.members;
                        animeObject["favorites"] = animeDetails.body.favorites;
                        animeObject["image"] = animeDetails.body.image_url;

                        let objectGenres = [];
                        animeDetails.body.genres.forEach(genre => {
                            objectGenres.push(genre.mal_id);
                        });
                        animeObject["genres"] = objectGenres;

                        let options = {
                            uri:
                                "https://api.jikan.moe/v3/anime/" +
                                anime.mal_id +
                                "/recommendations",
                            json: true
                        };
                        limiter
                            .request(options)
                            .then(recDetails => {
                                let recs = [];
                                recDetails.body.recommendations.forEach(rec => {
                                    if (rec.recommendation_count > 10) {
                                        recs.push({
                                            mal_id: rec.mal_id,
                                            count: rec.recommendation_count
                                        });
                                    }
                                });
                                let recsJSON = JSON.stringify(recs);
                                animeObject["recommendations"] = recsJSON;

                                // let animeJSON = JSON.stringify(animeObject);
                                // console.log(animeJSON);
                                return db.insertAnime(animeObject);
                            })
                            .then(res => {
                                console.log(res);
                            })
                            .catch(err => {
                                console.log(err);
                            });
                    })
                    .catch(err => {
                        console.log(err);
                    });
            });
        })
        .catch(err => {
            console.log(err);
        });
};

// db.dropTableList();
db.dropTableAnime();
setTimeout(() => {
    // db.createTableList();
    // retrieveUserAnimeList("uclazlo");
    db.createTableAnime();
    populateAnimeDB("uclazlo");
}, 200);
