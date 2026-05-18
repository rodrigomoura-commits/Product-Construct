import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "./src/lib/firebase";
import { upsertUserProductAccess } from "./src/lib/userProductAccess";

async function run() {
  const usersRef = collection(db, "users");
  const usersSnap = await getDocs(usersRef);
  let rodrigoUser = null;
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.email === "celular@rodrigomoura.net") {
      rodrigoUser = { id: doc.id, ...data };
    }
  });

  if (rodrigoUser && rodrigoUser.uid) {
    const productId = "NBC4N4HN3L5J3MNRgSJF";
    console.log("Found Rodrigo user", rodrigoUser.uid);
    await upsertUserProductAccess({
      uid: rodrigoUser.uid,
      product: {
        id: productId,
        name: "Epic Builder",
        description: "Epic Builder",
        status: "active",
        current_stage: "sense",
        progress: 15
      },
      role: "editor",
    });
    console.log("Upserted user_product_access");
  } else {
    console.log("User not found or no uid");
  }

  // Also auto-fix legacy for all owner products if missing
  if (rodrigoUser && rodrigoUser.uid) {
     const productsSnap = await getDocs(collection(db, "products"));
     for (const p of productsSnap.docs) {
       const udata = p.data();
       if (udata.created_by === rodrigoUser.uid || udata.owner_id === rodrigoUser.uid) {
          await upsertUserProductAccess({
            uid: rodrigoUser.uid,
            product: {
              id: p.id,
              name: udata.name || udata.title,
              description: udata.description || udata.summary,
              status: udata.status,
              current_stage: udata.current_stage || udata.stage,
              progress: udata.progress || udata.overall_progress
            },
            role: "owner",
          });
       }
     }
  }
}

run().catch(console.error);
