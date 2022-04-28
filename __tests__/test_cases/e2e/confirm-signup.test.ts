import * as Chance from 'chance';
// import * as dotenv from 'dotenv';
import { DynamoDB, CognitoIdentityServiceProvider } from 'aws-sdk';
require('dotenv').config()


const chance = Chance.Chance();
const docClient = new DynamoDB.DocumentClient({region: process.env.AWS_REGION});
const cognito = new CognitoIdentityServiceProvider();
const user_table = process.env.USERS_TABLE;

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const random_user = () => {
  const firstName = chance.first({nationality: 'en'});
  const lastName = chance.first({nationality: 'en'});
  const suffix = chance.string({length:4, pool: 'abcdefghijklmnopqrstuvwxyz'})
  const name = `${firstName} ${lastName} ${suffix}`;
  const password = chance.string({length: 8});
  const email = `${firstName}${lastName}${suffix}@gmail.com`;
  return {
    name,
    password,
    email
  }
}

describe('When a user signup', () => {
  it("Saves profile in dynamodb", async () => {
    const {name, email, password }  = random_user();
    const signupRes = await cognito.signUp({
      ClientId: process.env.COGNITO_CLIENT_ID??"",
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'name',
          Value: name
        }
      ]
    }).promise()
    const username = signupRes.UserSub;
    await cognito.adminConfirmSignUp({
      UserPoolId: userPoolId??"",
      Username: username
    }).promise()

    console.log(` ${email} signup confirmed`);
    const User = await docClient.get({
      TableName: user_table||"",
      Key: {
        id: username
      }
    }).promise()
    expect(User.Item).toBeTruthy();
    expect(User.Item).toMatchObject({
      id: username,
      name,
      screenName: 'Test',
      followersCount: 0,
      followingCount: 0
    })
  })
})