import { Session } from 'neo4j-driver';

export default interface Context {
  req: any;
  res: any;
  user: {
    id: string;
    username: string;
    email: string;
  } | null;
  neo4jSession: Session;
}