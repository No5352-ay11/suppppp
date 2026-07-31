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
 * Datenbank vorbereiten
 */

async function setupDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS login_attempts (
            id SERIAL PRIMARY KEY,
            username1 VARCHAR(100) NOT NULL,
            username2 VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/*
 * Zwei Benutzernamen speichern
 */

app.post("/api/login-attempt", async (req, res) => {

    try {

        const {
            username1,
            username2
        } = req.body;


        /*
         * Prüfen
         */

        if (
            typeof username1 !== "string" ||
            typeof username2 !== "string"
        ) {

            return res.status(400).json({
                error: "Beide Benutzernamen sind erforderlich."
            });

        }


        const cleanUsername1 =
            username1.trim();

        const cleanUsername2 =
            username2.trim();


        if (
            cleanUsername1 === "" ||
            cleanUsername2 === ""
        ) {

            return res.status(400).json({
                error: "Beide Felder müssen ausgefüllt sein."
            });

        }


        /*
         * Maximale Länge
         */

        if (
            cleanUsername1.length > 100 ||
            cleanUsername2.length > 100
        ) {

            return res.status(400).json({
                error: "Ein Benutzername ist zu lang."
            });

        }


        /*
         * In PostgreSQL speichern
         */

        await pool.query(
            `
            INSERT INTO login_attempts
            (username1, username2)
            VALUES ($1, $2)
            `,
            [
                cleanUsername1,
                cleanUsername2
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
 * Anmeldeversuche abrufen
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
                    username1,
                    username2,
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
 * Eintrag löschen
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
 * Server starten
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
