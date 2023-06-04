export const imageFileFilter = (req, file, callback) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
    return callback(new Error("Only image files are allowed!"), false);
  }
  callback(null, true);
};

export const editFileName = (req, file, callback) => {
  const fileExtName = file.originalname.slice(((file.originalname.lastIndexOf(".") - 1) + 2));
  const time = Date.now();
  callback(null, `${time}.${fileExtName}`);
};