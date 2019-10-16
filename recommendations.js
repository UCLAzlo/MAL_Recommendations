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
            populateAnimeDB(user);
        })
        .catch(err => {
            console.log(err);
        });
};

//
// Use Jikan API to populate anime database based on user anime list
//
const populateAnimeDB = user => {
    //select user list from db
    db.selectUserAnime(user)
        .then(res => {
            let animeList = res.rows[0].list;
            //for each anime in list, populate full details in anime db
            animeList.forEach(anime => {
                let animeObject = {};
                let options = {
                    uri: "https://api.jikan.moe/v3/anime/" + anime.mal_id,
                    json: true
                };
                //request general anime details and populate
                limiter
                    .request(options)
                    .then(animeDetails => {
                        // let animeObject = {};
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
                        return limiter.request(options);
                    })
                    //populate user recommendations for each anime
                    .then(recDetails => {
                        let recs = [];
                        recDetails.body.recommendations.forEach(rec => {
                            //only keep recommendations with significant count
                            if (rec.recommendation_count > 10) {
                                recs.push({
                                    mal_id: rec.mal_id,
                                    count: rec.recommendation_count
                                });
                            }
                        });
                        let recsJSON = JSON.stringify(recs);
                        animeObject["recommendations"] = recsJSON;
                        return db.insertAnime(animeObject);
                    })
                    //store anime details into anime db
                    .then(res => {
                        console.log(res);
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

const getRecommendations = user => {
    //select user list from db
    db.selectUserAnime(user)
        .then(res => {
            let promises = [];
            let animeList = res.rows[0].list;
            animeList.forEach(anime => {
                promises.push(db.selectSpecAnime(anime.mal_id));
            });

            return Promise.all(promises);
        })
        .then(res => {
            console.log(res);
        })
        .catch(err => {
            console.log(err);
        });
};

// db.dropTableList();
// db.dropTableAnime();
setTimeout(() => {
    // db.createTableList();
    // retrieveUserAnimeList("uclazlo");
    // db.createTableAnime();
    // populateAnimeDB("uclazlo");
    getRecommendations("uclazlo");
}, 200);
