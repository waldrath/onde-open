import {neon} from '@neondatabase/serverless';
let client:ReturnType<typeof neon>|undefined;
function sql(){return client??=neon(process.env.DATABASE_URL!);}
class Statement{
 constructor(readonly text:string,readonly values:unknown[]=[]){ }
 bind(...values:unknown[]){return new Statement(this.text,values);}
 compiled(){let i=0;let text=this.text.replace(/\?/g,()=>'$'+(++i));if(text.startsWith('INSERT OR IGNORE INTO '))text=text.replace('INSERT OR IGNORE INTO ','INSERT INTO ')+' ON CONFLICT DO NOTHING';return {text,values:this.values};}
 query(){const q=this.compiled();return sql().query(q.text,q.values,{fullResults:true});}
 async all<T>(){const r=await this.query();return {results:r.rows as T[]};}
 async first<T>(){return (await this.all<T>()).results[0]??null;}
 async run(){const r=await this.query();return {meta:{changes:r.rowCount??0}};}
}
export const db={prepare:(text:string)=>new Statement(text),async batch(statements:Statement[]){return sql().transaction(tx=>statements.map(s=>{const q=s.compiled();return tx.query(q.text,q.values);}));}};
