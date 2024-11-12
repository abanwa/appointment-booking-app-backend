import jwt from "jsonwebtoken";

// doctor authentication middleware
const authDoctor = async (req, res, next) => {
  try {
    const { dtoken } = req.headers;
    if (!dtoken) {
      return res.json({
        success: false,
        message: "Not Authorized. Login Again"
      });
    }

    // verify user token
    const token_decode = jwt.verify(dtoken, process.env.JWT_SECRET);

    if (!token_decode?.id) {
      return res.json({
        success: false,
        message: "Invalid token"
      });
    }

    req.body.docId = token_decode?.id;

    next();
  } catch (err) {
    console.log("error from authDoctor in middleware ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

export default authDoctor;
