import jwt from "jsonwebtoken";

// user authentication middleware
const authUser = async (req, res, next) => {
  try {
    const { token } = req.headers;
    if (!token) {
      return res.json({
        success: false,
        message: "Not Authorized. Login Again"
      });
    }

    // verify user token
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);

    if (!token_decode?.id) {
      return res.json({
        success: false,
        message: "Invalid token"
      });
    }

    req.body.userId = token_decode?.id;

    next();
  } catch (err) {
    console.log("error from authUser in middleware ", err);
    res.json({
      success: false,
      message: err.message
    });
  }
};

export default authUser;
