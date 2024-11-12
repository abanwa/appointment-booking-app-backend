import validator from "validator";
import bcrypt from "bcrypt";
import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import razorpay from "razorpay";

// API to register user
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({
        success: false,
        message: "missing details"
      });
    }

    // validate email
    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "enter a valid email address"
      });
    }

    // validate password
    if (password.length < 8) {
      return res.json({
        success: false,
        message: "enter a strong password"
      });
    }

    // hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData = {
      name,
      email,
      password: hashedPassword
    };

    const newUser = new userModel(userData);
    const user = await newUser.save();

    // we will use the user id to create a token
    const token = jwt.sign({ id: user?._id }, process.env.JWT_SECRET);

    res.json({
      success: true,
      token
    });
  } catch (err) {
    console.log("error from registerUser in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API for User Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({
        success: false,
        message: "missing details"
      });
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({
        success: false,
        message: "User does not exist"
      });
    }

    // compare/match password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({
        success: false,
        message: "invalid credentials"
      });
    }

    const token = jwt.sign({ id: user?._id }, process.env.JWT_SECRET);
    res.json({
      success: true,
      token
    });
  } catch (err) {
    console.log("error from loginUser in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to get user profile data
const getProfile = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.json({
        success: false,
        message: "User Id missing"
      });
    }

    const userData = await userModel.findById(userId).select("-password");
    if (!userData) {
      return res.json({
        success: false,
        message: "User does not exist!"
      });
    }

    res.json({
      success: true,
      userData
    });
  } catch (err) {
    console.log("error from getProfile in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to update user profile
const updateProfile = async (req, res) => {
  try {
    const { userId, name, phone, dob, gender, address } = req.body;
    const imageFile = req.file;
    let updatedData;

    if (!userId || !name || !phone || !address || !dob || !gender) {
      return res.json({
        success: false,
        message: "Data Missing"
      });
    }

    updatedData = await userModel.findByIdAndUpdate(
      userId,
      {
        name,
        phone,
        address: JSON.parse(address),
        dob,
        gender
      },
      { new: true }
    );

    // if the user has an image, we will delete it from the cloudinary account
    // if there is a new image, we will delete the old image if the image is a cloudinary image and not base64 image
    // https://res.cloudinary.com/do6ksl4ly/image/upload/v1730468437/rvokaqhieibdht4kqnoz.png
    // data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAYAAAA
    if (
      imageFile &&
      updatedData.image.startsWith("https://res.cloudinary.com")
    ) {
      // get the id of the image for the cloudinary
      const imgId = updatedData.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(imgId);
      console.log("imgId deleted : ", imgId);
    }

    // we will now upload the new image file that we want to update
    if (imageFile) {
      // upload image to cloudinary
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: "image"
      });
      const imageURL = imageUpload?.secure_url;

      updatedData = await userModel.findByIdAndUpdate(
        userId,
        { image: imageURL },
        { new: true }
      );
    }

    res.json({
      success: true,
      message: "Profile Updated",
      updatedData
    });
  } catch (err) {
    console.log("error from updateProfile in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to book appointment
const bookAppointment = async (req, res) => {
  try {
    const { userId, docId, slotDate, slotTime } = req.body;
    if (!userId || !docId || !slotDate || !slotTime) {
      return res.json({
        success: false,
        message: "Data Missing"
      });
    }

    // get the doctor details we want to book
    const docData = await doctorModel.findById(docId).select("-password");

    if (!docData) {
      return res.json({
        success: false,
        message: "Doctor does not exist"
      });
    }

    // we will check if the doctor is available or not to take the bookings
    if (!docData.available) {
      return res.json({
        success: false,
        message: "Doctor not available"
      });
    }

    let slots_booked = docData.slots_booked;
    // we will check for slot availability to check if the time and date the user wants to book has already been booked by someone else
    // we will check if the slotDate already is in the slot_booked array
    if (slots_booked[slotDate]) {
      if (slots_booked[slotDate].includes(slotTime)) {
        return res.json({
          success: false,
          message: "Slot not available"
        });
      } else {
        slots_booked[slotDate].push(slotTime);
      }
    } else {
      // we will create an array using the slotData
      slots_booked[slotDate] = [];
      // and push the time we booked in that array we created using the slotDate
      slots_booked[slotDate].push(slotTime);
    }

    // we will get the data of the user
    const userData = await userModel.findById(userId).select("-password");
    if (!userData) {
      return res.json({
        success: false,
        message: "User does not exist"
      });
    }

    // we will remove the slots_booked from the Doctor Data or details.
    // we do not want the records/history of the Doctor's booked slots to be seen when inserted into the appointment table
    delete docData.slots_booked;

    // Date.now() will give us the timestamp of current data and time
    const appointmentData = {
      userId,
      docId,
      userData,
      docData,
      amount: docData.fees,
      slotTime,
      slotDate,
      date: Date.now()
    };

    const newAppointment = new appointmentModel(appointmentData);
    await newAppointment.save();

    // save the new slots in docData (doctors data)
    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    res.json({
      success: true,
      message: "Appointment booked"
    });
  } catch (err) {
    console.log("error from bookAppointment in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// we will get list of appointments that the user has booked
// API to get user appointments for frontend my-appointment page
const listAppointment = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.json({
        success: false,
        message: "Data Missing"
      });
    }

    const appointments = await appointmentModel.find({ userId });
    if (!appointments) {
      return res.json({
        success: false,
        message: "No appointments"
      });
    }

    res.json({
      success: true,
      appointments
    });
  } catch (err) {
    console.log("error from listAppointment in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to cancel appointment in My-Appointments in frontend
const cancelAppointment = async (req, res) => {
  try {
    const { userId, appointmentId } = req.body;
    if (!userId || !appointmentId) {
      return res.json({
        success: false,
        message: "Data Missing"
      });
    }

    const appointmentData = await appointmentModel.findById(appointmentId);
    // verify if the person that booked the appointment is the same as the person that wants to cancel the appointment. if their id is the same
    if (appointmentData.userId.toString() !== userId.toString()) {
      return res.json({
        success: false,
        message: "Unauthorized action"
      });
    }

    // we will cancel the appointment by updating the cancel to True
    await appointmentModel.findByIdAndUpdate(appointmentId, {
      cancelled: true
    });

    // we will remove the booked date from the doctor's booked_slots
    const { docId, slotDate, slotTime } = appointmentData;
    // we will get the doctorData using the docId
    const doctorData = await doctorModel.findById(docId);

    let slots_booked = doctorData.slots_booked;
    // we will filter out the
    slots_booked[slotDate] = slots_booked[slotDate].filter(
      (time) => time !== slotTime
    );

    // check if there are other appointments for that specific day
    if (!slots_booked[slotDate].length) {
      for (let key in slots_booked) {
        if (key === slotDate) {
          delete slots_booked[key];
        }
      }
    }

    // we will update the doctors slots_booked
    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    res.json({
      success: true,
      message: "Appointment Cancelled"
    });
  } catch (err) {
    console.log("error from cancelAppointment in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KET_SECRET
});

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) {
      return res.json({
        success: false,
        message: "Data Missing"
      });
    }
    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData || appointmentData?.cancelled) {
      return res.json({
        success: false,
        message: "Appointment cancelled or not found"
      });
    }

    // create options for razor payment
    const options = {
      amount: appointmentData?.amount * 100,
      currency: process.env.CURRENCY,
      receipt: appointmentId
    };

    // creation of an order
    const order = await razorpayInstance.orders.create(options);
    res.json({
      success: true,
      order
    });
  } catch (err) {
    console.log("error from paymentRazorpay in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
    console.log("orderInfo : ", orderInfo);
    if (orderInfo.status === "paid") {
      // we will update our appointment to paid(true)
      // receipt is the appointment id
      await appointmentModel.findByIdAndUpdate(orderInfo.receipt, {
        payment: true
      });
      res.json({
        success: true,
        message: "Payment Successful"
      });
    } else {
      res.json({
        success: false,
        message: "Payment Failed"
      });
    }
  } catch (err) {
    console.log("error from verifyRazorpay in userController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

export {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  bookAppointment,
  listAppointment,
  cancelAppointment,
  paymentRazorpay,
  verifyRazorpay
};
