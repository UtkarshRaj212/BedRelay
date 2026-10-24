import http from "k6/http";
import { check } from "k6";

export const options = {
    vus: 50,
    iterations: 1000,
};

export default function () {
    const res = http.get("http://localhost:3000/api/server");

    check(res, {
        "status is 200": (r) => r.status === 200,
    });
}