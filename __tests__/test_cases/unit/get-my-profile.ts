import * as Chance from 'chance';
import * as  path from 'path';
import * as fs from 'fs'
import  { create } from 'amplify-appsync-simulator/lib/velocity/util';
import  { map } from 'amplify-appsync-simulator/lib/velocity/value-mapper/mapper';
import * as velocityTemplate from 'velocityjs';
const chance = Chance.Chance();

describe('Query.getMyProfile.request template', () => {
  it("Should use username as 'id'", () => {
    const templatePath = path.resolve(__dirname, '../../../mapping-templates/Query.getMyProfile.request.vtl')

    const username = chance.guid()
    const util = create([], new Date(), Object())
    
    const template = fs.readFileSync(templatePath, { encoding: 'utf-8' })
    const ast = velocityTemplate.parse(template)
    const compiler = new velocityTemplate.Compile(ast, {
      valueMapper: map,
      escape: false
    })
    const context = {
      identity: { username },
      args:{},
      arguments: {}
    }
    const ctx =  {
      context,
      ctx: context,
      util,
      utils: util
    }
    const result = JSON.parse(compiler.render(ctx))

    expect(result).toEqual({
      "version" : "2018-05-29",
      "operation" : "GetItem",
      "key" : {
        "id" : {
          "S": username
        }
      }
    })
  })
})