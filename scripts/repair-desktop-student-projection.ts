import { syncUsersToStudentsProjection } from "@/lib/services/student-projection";

const result = await syncUsersToStudentsProjection();

console.log(
  JSON.stringify(
    {
      result,
    },
    null,
    2,
  ),
);
