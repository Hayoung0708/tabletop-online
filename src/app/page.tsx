import { redirect } from "next/navigation";

/**
 * 루트 경로 진입 시 로비로 보낸다.
 */
const Home = (): never => {
  redirect("/lobby");
};

export default Home;
