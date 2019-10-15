// Postgres
const Pool = require("pg").Pool;

// Env parameters
const dotenv = require("dotenv");
dotenv.config();

const pool = new Pool({
    user: "admin",
    host: "localhost",
    database: "animeDB",
    password: process.env.DATABASE_PASSWD,
    port: 5432
});

//
// Create Table for user listings
//
const createTableList = () => {
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
// Create Table of Anime and Relevant Details
//
const createTableAnime = () => {
    const queryText = `CREATE TABLE IF NOT EXISTS animeList(
        id INT NOT NULL,
        title VARCHAR(64) NOT NULL,
        score NUMERIC(3,2) NOT NULL,
        popularity INT NOT NULL,
        members INT NOT NULL,
        favorites INT NOT NULL,
        image VARCHAR(512) NOT NULL,
        genres INT[] NOT NULL,
        recommendations JSONB NOT NULL
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
// Drop table for user listing
//
const dropTableList = () => {
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
// Drop table for anime
//
const dropTableAnime = () => {
    const queryText = "DROP TABLE IF EXISTS animeList";
    pool.query(queryText)
        .then(res => {
            console.log(res);
        })
        .catch(err => {
            console.log(err);
        });
};

//
// Add user list to list table
//
const insertList = (user, list) => {
    const queryText = `INSERT INTO userlist
        VALUES ($1, $2);`;
    const values = ["user", list];
    return pool.query(queryText, values);
};

module.exports = {
    createTableList,
    createTableAnime,
    dropTableList,
    dropTableAnime,
    insertList
};
