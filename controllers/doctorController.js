import doctorModel from "../models/doctorModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import appointmentModel from "../models/appointmentModel.js";

const changeAvailability = async (req, res) => {
  try {
    const { docId } = req.body;

    if (!docId) {
      return res.json({
        success: false,
        message: "ID required"
      });
    }

    const docData = await doctorModel.findById(docId);

    if (!docData) {
      return res.json({
        success: false,
        message: "Doctor not found"
      });
    }
    // if the available is true, it will be negated to false vice versa
    await doctorModel.findByIdAndUpdate(docId, {
      available: !docData.available
    });
    res.json({
      success: true,
      message: "Availability changed"
    });
  } catch (err) {
    console.log("error from changeAvailability in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

const doctorList = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select(["-email", "-password"]);
    res.json({
      success: true,
      doctors
    });
  } catch (err) {
    console.log("error from doctorList in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API for doctor login
const loginDoctor = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({
        success: false,
        message: "Mising Data"
      });
    }

    // const doctor = await doctorModel.findOne({ email, password });
    const doctor = await doctorModel.findOne({ email });
    if (!doctor) {
      return res.json({
        success: false,
        message: "Invalid Credentials"
      });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid Credentials!!"
      });
    }
    const token = jwt.sign({ id: doctor?._id }, process.env.JWT_SECRET);
    res.json({
      success: true,
      token
    });
  } catch (err) {
    console.log("error from loginDoctor in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to get doctor appointments for the doctor panel
const appointmentsDoctor = async (req, res) => {
  try {
    const { docId } = req.body;
    if (!docId) {
      return res.json({
        success: false,
        message: "Mising Data"
      });
    }

    // we will find the appointments for the doctor
    const appointments = await appointmentModel.find({ docId });
    res.json({
      success: true,
      appointments
    });
  } catch (err) {
    console.log("error from appointmentsDoctor in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to mark appointment completed for doctor panel
const appointmentComplete = async (req, res) => {
  try {
    const { docId, appointmentId } = req.body;
    if (!docId || !appointmentId) {
      return res.json({
        success: false,
        message: "Mising Data"
      });
    }

    const appointmentData = await appointmentModel.findById(appointmentId);
    if (
      !appointmentData ||
      appointmentData?.docId?.toString() !== docId?.toString()
    ) {
      return res.json({
        success: false,
        message: "Appointment not found or appointment doctor ID do not match"
      });
    }

    if (appointmentData?.isCompleted) {
      return res.json({
        success: false,
        message: "Appointment already completed"
      });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      isCompleted: true
    });

    // we will remove the booked date from the doctor's booked_slots after the doctor has updated it to be completed
    const { slotDate, slotTime } = appointmentData;
    // we will get the doctorData using the docId
    const doctorData = await doctorModel.findById(docId);

    let slots_booked = doctorData.slots_booked;
    // we will filter out the
    slots_booked[slotDate] = slots_booked[slotDate]?.filter(
      (time) => time !== slotTime
    );

    // check if there are other appointments for that specific day
    if (!slots_booked[slotDate]?.length) {
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
      message: "Appointment completed"
    });
  } catch (err) {
    console.log("error from appointmentComplete in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to cancel appointment completed for doctor panel
const appointmentCancel = async (req, res) => {
  try {
    const { docId, appointmentId } = req.body;
    if (!docId || !appointmentId) {
      return res.json({
        success: false,
        message: "Mising Data"
      });
    }

    const appointmentData = await appointmentModel.findById(appointmentId);
    if (
      !appointmentData ||
      appointmentData?.docId?.toString() !== docId?.toString()
    ) {
      return res.json({
        success: false,
        message: "Appointment not found or appointment doctor ID do not match"
      });
    }

    if (appointmentData?.cancelled) {
      return res.json({
        success: false,
        message: "Appointment already cancelled"
      });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      cancelled: true
    });

    // we will remove the booked date from the doctor's booked_slots after the doctor has updated it to be completed
    const { slotDate, slotTime } = appointmentData;
    // we will get the doctorData using the docId
    const doctorData = await doctorModel.findById(docId);

    let slots_booked = doctorData.slots_booked;
    // we will filter out the
    slots_booked[slotDate] = slots_booked[slotDate]?.filter(
      (time) => time !== slotTime
    );

    // check if there are other appointments for that specific day
    if (!slots_booked[slotDate]?.length) {
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
      message: "Appointment cancelled"
    });
  } catch (err) {
    console.log("error from appointmentCancel in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to get dashbaord data for doctor panel
const doctorDashboard = async (req, res) => {
  try {
    const { docId } = req.body;
    if (!docId) {
      return res.json({
        success: false,
        message: "Mising Data"
      });
    }

    const appointments = await appointmentModel.find({ docId });
    let earnings = 0;

    appointments.length > 0 &&
      appointments.map((item) => {
        if (item?.isCompleted || item.payment) {
          earnings += item?.amount;
        }
      });

    // No of unique patients
    let patients = [];
    appointments.length > 0 &&
      appointments.map((item) => {
        if (!patients.includes(item?.userId)) {
          patients.push(item?.userId);
        }
      });

    const dashData = {
      earnings,
      appointments: appointments?.length,
      patients: patients?.length,
      latestAppointments: appointments.reverse().slice(0, 5)
    };

    res.json({
      success: true,
      dashData
    });
  } catch (err) {
    console.log("error from doctorDashboard in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to get doctor profile for doctor panel
const doctorProfile = async (req, res) => {
  try {
    const { docId } = req.body;
    if (!docId) {
      return res.json({
        success: false,
        message: "Mising Data"
      });
    }

    const profileData = await doctorModel.findById(docId).select("-password");
    res.json({
      success: true,
      profileData
    });
  } catch (err) {
    console.log("error from doctorProfile in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

// API to update doctor profile data in doctor panel
const updateDoctorProfile = async (req, res) => {
  try {
    const { docId, fees, address, available } = req.body;
    if (!docId || !fees || !address) {
      return res.json({
        success: false,
        message: "Mising Data"
      });
    }

    const updatedProfileData = await doctorModel
      .findByIdAndUpdate(docId, { fees, address, available }, { new: true })
      .select("-password");

    res.json({
      success: true,
      message: "Profile updated",
      updatedProfileData
    });
  } catch (err) {
    console.log("error from updateDoctorProfile in doctorController ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

export {
  changeAvailability,
  doctorList,
  loginDoctor,
  appointmentsDoctor,
  appointmentComplete,
  appointmentCancel,
  doctorDashboard,
  doctorProfile,
  updateDoctorProfile
};
