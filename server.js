const express = require("express");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 10000;


/*
 * PostgreSQL
 */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});


/*
 * Middleware
 */

app.use(express.json());

app.use(express.static("public"));


/*
 * Datenbank erstellen
 */

async function setupDatabase() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS login_attempts (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) NOT NULL,
            password VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Datenbank bereit.");
}


/*
 * LOGIN-VERSUCH SPEICHERN
 *
 * Es wird absichtlich KEIN Passwort gespeichert.
 */

app.post("/api/login-attempt", async (req, res) => {

    try {

        const {
            username,
            passwordProvided
        } = req.body;


        /*
         * Benutzername prüfen
         */

        if (
            typeof username !== "string" ||
            username.trim() === ""
        ) {

            return res.status(400).json({
                error: "Benutzername fehlt."
            });

        }


        const cleanUsername =
            username.trim();


        /*
         * Maximale Länge
         */

        if (cleanUsername.length > 100) {

            return res.status(400).json({
                error: "Benutzername ist zu lang."
            });

        }


        /*
         * Login-Versuch speichern
         *
         * ACHTUNG:
         * Das Passwort wird NICHT gespeichert.
         */

        await pool.query(
            `
            INSERT INTO login_attempts
            (username, password_provided)
            VALUES ($1, $2)
            `,
            [
                cleanUsername,
                Boolean(passwordProvided)
            ]
        );


        res.json({
            success: true
        });


    } catch (error) {

        console.error(
            "Fehler beim Speichern:",
            error
        );

        res.status(500).json({
            error: "Serverfehler."
        });

    }

});


/*
 * LOGIN-VERSUCHE ABRUFEN
 *
 * Nur mit deinem Admin-Passwort.
 */

app.get("/api/login-attempts", async (req, res) => {

    try {

        const password =
            req.headers["x-admin-password"];


        /*
         * Admin-Passwort prüfen
         */

        if (
            !process.env.ADMIN_PASSWORD ||
            password !== process.env.ADMIN_PASSWORD
        ) {

            return res.status(401).json({
                error: "Nicht autorisiert."
            });

        }


        const result =
            await pool.query(`
                SELECT
                    id,
                    username,
                    password_provided,
                    created_at
                FROM login_attempts
                ORDER BY created_at DESC
            `);


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Serverfehler."
        });

    }

});


/*
 * LOGIN-VERSUCH LÖSCHEN
 */

app.delete(
    "/api/login-attempts/:id",
    async (req, res) => {

        try {

            const password =
                req.headers["x-admin-password"];


            if (
                !process.env.ADMIN_PASSWORD ||
                password !== process.env.ADMIN_PASSWORD
            ) {

                return res.status(401).json({
                    error: "Nicht autorisiert."
                });

            }


            const id =
                Number(req.params.id);


            if (!Number.isInteger(id)) {

                return res.status(400).json({
                    error: "Ungültige ID."
                });

            }


            await pool.query(
                `
                DELETE FROM login_attempts
                WHERE id = $1
                `,
                [id]
            );


            res.json({
                success: true
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Serverfehler."
            });

        }

    }
);


/*
 * SERVER STARTEN
 */

setupDatabase()
    .then(() => {

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `Server läuft auf Port ${PORT}`
                );

            }
        );

    })
    .catch((error) => {

        console.error(
            "Datenbankfehler:",
            error
        );

        process.exit(1);

    });
