import { handler } from '../../../functions/confirm-user-signup';
import * as Chance from 'chance';
// import * as dotenv from 'dotenv';
import { DynamoDB } from 'aws-sdk';
require('dotenv').config()


const chance = Chance.Chance();
const docClient = new DynamoDB.DocumentClient({region: process.env.AWS_REGION});
const user_table = process.env.USERS_TABLE;

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

describe('confirm user signup', () => {
  it("Saves profile in dynamodb", async () => {
    const {name, email}  = random_user();
    const userName = chance.guid();
    const event = {
      version: "1",
      region: process.env.AWS_REGION,
      userpoolId: process.env.COGNITO_USER_POOL_ID,
      userName,
      triggerSource: "PostConfirmation_ConfirmSignUp",
      request: {
        userAttributes : {
          sub: email,
          "cognito:email_alias": email,
          "cognito:user_status": "CONFIRMED",
          email_verified: "true",
          name,
          email
        }
      }
    }

    const res = await handler(event);
    console.log(`Looking for user ${res.id} in the table ${user_table}`);
    const User = await docClient.get({
      TableName: user_table?user_table:"",
      Key: {
        id: res.username
      }
    }).promise()
    expect(User.Item).toBeTruthy();
    expect(User.Item).toMatchObject({
      id: res.username,
      name,
      screenName: 'Test',
      followersCount: 0,
      followingCount: 0
    })
  })
})