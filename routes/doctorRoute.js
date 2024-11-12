import express from "express";
import {
  appointmentCancel,
  appointmentComplete,
  appointmentsDoctor,
  doctorDashboard,
  doctorList,
  doctorProfile,
  loginDoctor,
  updateDoctorProfile
} from "../controllers/doctorController.js";
import authDoctor from "../middlewares/authDoctor.js";

const doctorRouter = express.Router();

doctorRouter.get("/list", doctorList);
doctorRouter.post("/login", loginDoctor);

doctorRouter.use(authDoctor);
doctorRouter.get("/appointments", appointmentsDoctor);
doctorRouter.post("/complete-appointment", appointmentComplete);
doctorRouter.post("/cancel-appointment", appointmentCancel);
doctorRouter.get("/dashboard", doctorDashboard);
doctorRouter.get("/profile", doctorProfile);
doctorRouter.post("/update-profile", updateDoctorProfile);

export default doctorRouter;
