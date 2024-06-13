const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://soul-connect-bysam.web.app",
      "https://soul-connect-bysam.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// JWT Middleware
const logger = (req, res, next) => {
  console.log("log info", req.method, req.url);
  next();
};

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log("token in middleware ", token);
  if (!token) {
    res.status(401).json({ message: "Unauthorised Access" });
    return;
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Unauthorised Access" });
      return;
    }
    req.user = decoded;
    next();
  });
};

// routes
app.get("/", (req, res) => {
  res.send("Soul Connect server is running");
});

// listening port
app.listen(port, () => {
  console.log("Soul Connect server is listening on port " + port);
});

// mongoDB
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.wu8kmms.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // create a new database collection

    // Users Collection
    const userCollection = client.db("soulConnectDB").collection("users");

    // Biodata Collections
    const bidataIdCountersCollection = client
      .db("soulConnectDB")
      .collection("biodataIdCounters");
    const biodataCollection = client.db("soulConnectDB").collection("biodatas");

    // payments collection
    const paymentCollection = client.db("soulConnectDB").collection("payments");

    // Total Revenue Collection
    const totalRevenueCollection = client.db("soulConnectDB").collection("confirmedPayments");

    // Favorites Collection
    const favoritesCollection = client
      .db("soulConnectDB")
      .collection("favorites");

    // Premium biodata request collection
    const premiumBiodataRequestCollection = client
      .db("soulConnectDB")
      .collection("premiumBiodataRequest");

    // Success Story Collection
    const successStoryCollection = client
      .db("soulConnectDB")
      .collection("successStories");

    // API Calls

    // ================================== //
    //     Auth Related API Calls         //
    // ================================== //

    // creating token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      console.log("token", token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    //clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // ================================== //
    //             User Api's             //
    // ================================== //

    // Getting All Users
    app.get("/users", async (req, res) => {
      const cursor = await userCollection.find({});
      const users = await cursor.toArray();
      res.send(users);
    });

    app.patch("/users/make-premium/:id", async (req, res) => {
      const userId = req.params.id;
      try {
        const filter = { _id: new ObjectId(userId) };
        const update = { $set: { subscription: "premium" } };
        const result = await userCollection.updateOne(filter, update);
        res.json(result);
      } catch (error) {
        console.error("Error making user premium:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.patch("/users/make-admin/:id", async (req, res) => {
      const userId = req.params.id;
      try {
        const filter = { _id: new ObjectId(userId) };
        const update = { $set: { role: "admin" } };
        const result = await userCollection.updateOne(filter, update);
        res.json(result);
      } catch (error) {
        console.error("Error making user admin:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // getting user by mail
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const cursor = await userCollection.find({ email: email });
      const user = await cursor.toArray();
      res.send(user);
    });

    // getting user by username
    app.get("/users/username/:username", async (req, res) => {
      const username = req.params.username;
      const cursor = await userCollection.find({ username: username });
      const user = await cursor.toArray();
      res.send(user);
    });

    // Sending users data to server
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.json(result);
    });

    // Calculating total revenue
    app.get("/approved/payment/details", async (req, res) => {
      try {
          const result = await totalRevenueCollection
              .aggregate([
                  {
                      $group: {
                          _id: null,
                          totalRevenue: { $sum: "$paidAmount" },
                      },
                  },
              ])
              .toArray();
  
          const totalRevenue = result.length > 0 ? result[0].totalRevenue : 0;
          res.send({ totalRevenue });
      } catch (error) {
          res.status(500).send({ error: "Error calculating total revenue" });
      }
  });  

    // ================================== //
    //           Biodata Api's            //
    // ================================== //

    // Getting all biodatas
    app.get("/biodatas", async (req, res) => {
      const cursor = await biodataCollection.find({});
      const biodata = await cursor.toArray();
      res.send(biodata);
    });

    // getting biodata id count
    app.get("/biodataIdCounters", async (req, res) => {
      const counter = await bidataIdCountersCollection.findOne({
        _id: "biodataId",
      });
      res.json(counter);
    });

    // sending biodata id count to server
    app.patch("/biodataIdCounters", async (req, res) => {
      const counter = req.body;
      const result = await bidataIdCountersCollection.updateOne(
        { _id: "biodataId" },
        { $set: counter }
      );
      res.json(result);
    });

    // sending biodata data to server
    app.post("/biodatas", async (req, res) => {
      const biodata = req.body;
      const result = await biodataCollection.insertOne(biodata);
      res.json(result);
    });

    // View all biodata from same email
    app.get("/biodatas/:email", logger, verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const cursor = await biodataCollection.find({ contactEmail: email });
      const biodata = await cursor.toArray();
      res.send(biodata);
    });

    // get single biodata with id
    app.get("/biodatas/biodata/:id", async (req, res) => {
      const id = parseInt(req.params.id);
      const cursor = await biodataCollection.find({ biodataId: id });
      const biodata = await cursor.toArray();
      res.send(biodata);
    });

    // Get all male biodata
    app.get("/biodatas/similar/:gender", async (req, res) => {
      const gender =
        req.params.gender.charAt(0).toUpperCase() +
        req.params.gender.slice(1).toLowerCase();
      const cursor = await biodataCollection.find({ biodataType: gender });
      const biodata = await cursor.toArray();
      res.send(biodata);
    });

    // getting all premium biodata
    app.get("/biodatas/get-premium/biodata", async (req, res) => {
      const cursor = await biodataCollection.find({ biodataStatus: "premium" });
      const biodata = await cursor.toArray();
      res.send(biodata);
    });

    // Get the count of total, male, female, and premium biodata
    app.get("/biodata/counts", async (req, res) => {
      try {
        const totalCount = await biodataCollection.countDocuments();
        const totalMarriageCount =
          await successStoryCollection.countDocuments();
        const maleCount = await biodataCollection.countDocuments({
          biodataType: "Male",
        });
        const femaleCount = await biodataCollection.countDocuments({
          biodataType: "Female",
        });
        const premiumCount = await biodataCollection.countDocuments({
          biodataStatus: "premium",
        });

        res.send({
          totalCount,
          maleCount,
          femaleCount,
          premiumCount,
          totalMarriageCount,
        });
      } catch (error) {
        res.status(500).send({ error: "Error fetching biodata counts" });
      }
    });

    // updating the biodata
    app.patch("/biodatas/biodata/:biodataId", async (req, res) => {
      const biodataId = parseInt(req.params.biodataId);
      const updateFields = req.body;

      try {
        const result = await biodataCollection.updateOne(
          { biodataId: biodataId },
          { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
          res.status(200).json({ message: "Biodata updated successfully" });
        } else {
          res.status(404).json({ message: "Biodata not found" });
        }
      } catch (error) {
        res
          .status(500)
          .json({ message: "An error occurred", error: error.message });
      }
    });

    // Update biodata endpoint
    app.put("/data/bio/id/:biodataId", async (req, res) => {
      const biodataId = parseInt(req.params.biodataId);
      const updateFields = req.body;

      console.log("biodataid: " + biodataId);

      console.log("update fields", updateFields);

      // Construct the query to find the document by _id
      const query = { biodataId: biodataId };

      // Construct the update operation using $set operator
      const updateOperation = { $set: updateFields };

      // Update the document in the biodataCollection
      const result = await biodataCollection.updateOne(query, updateOperation);

      // Check if the document was updated successfully
      if (result.modifiedCount === 1) {
        res.status(200).json({ message: "Biodata updated successfully." });
      } else {
        res.status(404).json({ message: "Biodata not found." });
      }
    });

    // ======================================= //
    //              favorite APIs              //
    // ======================================= //

    // send favorite biodata to server
    app.post("/favouriteBiodata", async (req, res) => {
      const favoriteBiodata = req.body;
      const result = await favoritesCollection.insertOne(favoriteBiodata);
      res.json(result);
    });

    // getting all fav from same email
    app.get("/favouriteBiodata/:email", async (req, res) => {
      const email = req.params.email;
      const cursor = await favoritesCollection.find({ addedBy: email });
      const payments = await cursor.toArray();
      res.send(payments);
    });

    // deleting a favorite biodata based on object id
    app.delete("/favouriteBiodata/:objectId", async (req, res) => {
      const objectId = req.params.objectId;
      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(objectId),
      });
      res.json(result);
    });

    // ======================================= //
    //              Payments APIs              //
    // ======================================= //

    // Getting all payments
    app.get("/payments", async (req, res) => {
      const cursor = await paymentCollection.find({});
      const payments = await cursor.toArray();
      res.send(payments);
    });

    // sending payments to server
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.json(result);
    });

    // delete one data based on object id from payments collection
    app.delete("/payments/:biodataId", async (req, res) => {
      const biodataId = req.params.biodataId;
      const result = await paymentCollection.deleteOne({
        _id: new ObjectId(biodataId),
      });
      res.json(result);
    });

    // counting total revenue after confirming transaction
    app.post("/approved/payment/details", async (req, res) => {
      const confirmedPaymentDetails = req.body;
      const result = await totalRevenueCollection.insertOne(confirmedPaymentDetails);
      res.json(result);
    });

    // update one data based on _id
    app.patch("/payments/confirm/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const filter = { _id: new ObjectId(id) };
        const update = { $set: { status: "approved" } };

        const result = await paymentCollection.updateOne(filter, update);

        res.json(result);
      } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // ======================================= //
    //       Premium Biodata APIs           //
    // ======================================= //

    // sending all biodata-premium requests to server
    app.post("/premium-biodata-requests", async (req, res) => {
      const biodata = req.body;
      const result = await premiumBiodataRequestCollection.insertOne(biodata);
      res.json(result);
    });

    // getting all biodata-premium requests
    app.get("/premium-biodata-requests", async (req, res) => {
      const cursor = await premiumBiodataRequestCollection.find({});
      const requests = await cursor.toArray();
      res.send(requests);
    });

    // Update the status of premium biodata request by biodataId
    app.patch(
      "/premium-biodata-requests/biodata/:biodataId",
      async (req, res) => {
        const biodataId = parseInt(req.params.biodataId);

        try {
          const filter = { biodataId: biodataId };
          const update = { $set: { status: "approved" } };

          const result = await premiumBiodataRequestCollection.updateOne(
            filter,
            update
          );

          res.json(result);
        } catch (error) {
          console.error("Error updating payment status:", error);
          res.status(500).json({ message: "Internal Server Error" });
        }
      }
    );

    // ======================================= //
    //       requested contacts APIs           //
    // ======================================= //

    // getting all requests from same email
    app.get("/requests/:email", async (req, res) => {
      const email = req.params.email;
      const cursor = await paymentCollection.find({ email: email });
      const requests = await cursor.toArray();
      res.send(requests);
    });

    // ======================================= //
    //          Success Stories API            //
    // ======================================= //

    // Route for adding a success story
    app.post("/success-stories", async (req, res) => {
      const formData = req.body;
      try {
        const result = await successStoryCollection.insertOne(formData);
        res.status(201).json({
          message: "Success story added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding success story:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // getting all success stories in ascending order by marriage date
    app.get("/success-stories", async (req, res) => {
      const cursor = await successStoryCollection
        .find({})
        .sort({ marriageDate: 1 });
      const successStories = await cursor.toArray();
      res.send(successStories);
    });

    // ======================================= //
    //               Stripe setup              //
    // ======================================= //
    // Stripe secret API key.
    const stripe = require("stripe")(`${process.env.SK_STRIPE}`);

    // Payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
