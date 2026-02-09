export const updateProfile = async (req, res) => {
  const userId = req.user._id;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    req.body,
    { new: true }
  );

  return successResponse(
    res,
    200,
    "Profile updated",
    updatedUser
  );
};
