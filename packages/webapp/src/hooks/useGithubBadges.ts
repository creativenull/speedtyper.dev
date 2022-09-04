import { useEffect, useState } from "react";
import { useSiteData } from "react-static";
import ky from "ky-universal";
import type { IUser } from "../../types";

export default (user: IUser) => {
  const { serverUrl } = useSiteData();
  const username = user?.username;
  const [badges, setBadges] = useState([]);

  const badgetypes = ["averagewpm", "topwpm", "gamecount"];

  useEffect(() => {
    if (user?.username && !user?.guest) {
      Promise.all(
        badgetypes.map((badgetype) =>
          ky.get(`${serverUrl}/users/${username}/badges/${badgetype}`).text()
        )
      ).then((baddies) => {
        setBadges(baddies);
      });
    }
  }, [user]);

  return badges;
};