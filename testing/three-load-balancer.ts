import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const bedrelay1 = new Counter("bedrelay1_requests");
const bedrelay2 = new Counter("bedrelay2_requests");
const bedrelay3 = new Counter("bedrelay3_requests");

export const options = {
    scenarios: {
        load_test: {
            executor: "constant-vus",
            vus: 50,
            duration: "20s",
        },
    },
};

export default function () {
    const res = http.get("http://localhost/api/server");

    check(res, {
        "status is 200": (r) => r.status === 200,
    });

    if (res.status !== 200) {
        return;
    }

    const body = res.json();

    switch (body.instance) {
        case "bed-relay-instance-1":
            bedrelay1.add(1);
            break;
        case "bed-relay-instance-2":
            bedrelay2.add(1);
            break;
        case "bed-relay-instance-3":
            bedrelay3.add(1);
            break;
    }
}