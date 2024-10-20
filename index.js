const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv").config();
const URL = process.env.DB;

const DB_NAME = "movie_db";
const COLLECTION_NAME = "movies";

// Initialize MongoDB client once
let client;

(async () => {
  try {
    client = new MongoClient(URL, {});
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  }
})();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/movie/get-movies", async (req, res) => {
  try {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const movies = await collection.find({}).toArray();
    res.json(movies);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Validate ObjectId
const isValidObjectId = (id) => {
  return ObjectId.isValid(id) && (new ObjectId(id)).toString() === id;
};

app.get("/movie/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const db = client.db(DB_NAME);
    const dbcollection = db.collection(COLLECTION_NAME);
    const movie = await dbcollection.findOne({ _id: new ObjectId(id) });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(movie);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/movie/book-movie", async (req, res) => {
  const bookingRequest = req.body;

  if (!bookingRequest.movieId || !bookingRequest.showId || !bookingRequest.seats || !bookingRequest.name || !bookingRequest.email || !bookingRequest.phoneNumber) {
    return res.status(401).json({ message: "Some fields are missing" });
  }

  const requestedSeat = parseInt(bookingRequest.seats);
  if (isNaN(requestedSeat) || requestedSeat <= 0) {
    return res.status(401).json({ message: "Invalid seat count" });
  }

  try {
    const db = client.db(DB_NAME);
    const dbcollection = db.collection(COLLECTION_NAME);

    if (!isValidObjectId(bookingRequest.movieId)) {
      return res.status(400).json({ message: "Invalid movieId format" });
    }

    const movie = await dbcollection.findOne({ _id: new ObjectId(bookingRequest.movieId) });
    if (!movie) {
      return res.status(404).json({ message: "Requested movie is not found" });
    }

    const show = Object.values(movie.shows)
      .flat()
      .find((s) => s.id === bookingRequest.showId);

    if (!show) {
      return res.status(404).json({ message: "Show not found" });
    }

    if (parseInt(show.seats) < requestedSeat) {
      return res.status(404).json({ message: "Not enough seats available" });
    }

    const updateSeats = parseInt(show.seats) - requestedSeat;
    const date = Object.keys(movie.shows).find((d) =>
      movie.shows[d].some((s) => s.id === bookingRequest.showId)
    );

    const showIndex = movie.shows[date].findIndex(
      (s) => s.id === bookingRequest.showId
    );

    const userBooking = {
      name: bookingRequest.name,
      email: bookingRequest.email,
      phoneNumber: bookingRequest.phoneNumber,
      seats: bookingRequest.seats,
    };

    const updatedResult = await dbcollection.updateOne(
      {
        _id: new ObjectId(bookingRequest.movieId),
      },
      {
        $set: {
          [`shows.${date}.${showIndex}.seats`]: updateSeats,
        },
        $push: {
          [`shows.${date}.${showIndex}.bookings`]: userBooking,
        },
      }
    );

    if (updatedResult.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update" });
    }

    return res.status(200).json({ message: "Booking created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Ensure correct port
app.listen(8000, () => {
  console.log("Server is running on port 7000");
});
