import jwt from "jsonwebtoken";

export const TOKEN_SECRET = "santokhanhasdevelopedthisbrowserextension";

function createAccessToken() {
  const token = jwt.sign(
    {
      sub: "shohag"
    },
    TOKEN_SECRET,
    {
      expiresIn: "60d"
    }
  )

  return token;
}

console.log(createAccessToken());