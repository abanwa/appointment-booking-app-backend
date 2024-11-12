import validator from "validator";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import doctorModel from "../models/doctorModel.js";
import jwt from "jsonwebtoken";
import appointmentModel from "../models/appointmentModel.js";
import userModel from "../models/userModel.js";

// API for adding doctor
const addDoctor = async (req, res) => {
  try {
    // we will send the request in a formData format
    const {
      name,
      email,
      password,
      speciality,
      degree,
      experience,
      about,
      fees,
      address
    } = req.body;
    // to get the image file
    const imageFile = req.file;
    // console.log("imageFile : ", imageFile);
    // checking for all data to add doctor
    if (
      !name ||
      !email ||
      !password ||
      !speciality ||
      !degree ||
      !experience ||
      !about ||
      !fees ||
      !address
    ) {
      return res.json({
        success: false,
        message: "Missing Details"
      });
    }

    if (!imageFile) {
      return res.json({
        success: false,
        message: "Image is required"
      });
    }

    // validating email format
    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "Please enter a valid email"
      });
    }

    // validate strong password
    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Please enter a strong password"
      });
    }

    // hashing doctor password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // upload image to cloudinary
    const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
      resource_type: "image"
    });
    const imageUrl = imageUpload.secure_url;

    // we did JSON.parse() for the address because we are submitting the address as a json object. we converted it back to javascript object
    const doctorData = {
      name,
      email,
      image: imageUrl,
      password: hashedPassword,
      speciality,
      degree,
      experience,
      about,
      fees,
      address: JSON.parse(address),
      date: Date.now()
    };

    const newDoctor = new doctorModel(doctorData);
    await newDoctor.save();

    res.json({
      success: true,
      message: "Doctor Added"
    });
  } catch (err) {
    console.log("error from addDoctor in adminController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API for ADMIN LOGIN
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      // we will create a token and send it to the user
      const token = jwt.sign(email + password, process.env.JWT_SECRET);
      res.json({
        success: true,
        token
      });
    } else {
      res.json({
        success: false,
        message: "Invalid credentials"
      });
    }
  } catch (err) {
    console.log("error from loginAdmin in adminController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to get all doctors list for admin panel
const allDoctors = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select("-password");
    res.json({
      success: true,
      doctors
    });
  } catch (err) {
    console.log("error from allDoctors in adminController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to get all appointment list
const appointmentsAdmin = async (req, res) => {
  try {
    const appointments = await appointmentModel.find({});
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
    console.log("error from appointmentsAdmin in adminController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API for appointment cancellation
const appointmentCancel = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    if (!userId || !appointmentId) {
      return res.json({
        success: false,
        message: "Data Missing"
      });
    }

    const appointmentData = await appointmentModel.findById(appointmentId);

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
    console.log("error from cancelAppointment in adminController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to get dashboard data for admin Panel
const adminDashboard = async (req, res) => {
  try {
    const doctors = await doctorModel.find({});
    const users = await userModel.find({});
    const appointments = await appointmentModel.find({});

    const dashData = {
      doctors: doctors?.length,
      patients: users?.length,
      appointments: appointments?.length,
      latestAppointments: appointments.reverse().slice(0, 5)
    };

    res.json({
      success: true,
      dashData
    });
  } catch (err) {
    console.log("error from adminDashboard in adminController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

export {
  addDoctor,
  loginAdmin,
  allDoctors,
  appointmentsAdmin,
  appointmentCancel,
  adminDashboard
};
