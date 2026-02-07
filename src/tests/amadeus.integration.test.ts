import { AmadeusService } from "../agent/AmadeusService";

describe("AmadeusService integration", () => {
  let amadeus: AmadeusService;
  beforeAll(() => {
    amadeus = new AmadeusService();
  });

  it("should return real flight data from Amadeus API", async () => {
    const constraints = {
      from: "JFK",
      to: "LAX",
      depart: "2026-03-01",
      return: "2026-03-10",
      travelers: 1,
    };
    const flights = await amadeus.searchFlights(constraints);
    expect(Array.isArray(flights)).toBe(true);
    expect(flights.length).toBeGreaterThan(0);
    expect(flights[0]).toHaveProperty("from");
    expect(flights[0]).toHaveProperty("to");
    expect(flights[0]).toHaveProperty("price");
    expect(flights[0]).toHaveProperty("bookingLink");
  });

  it("should return real hotel data from Amadeus API", async () => {
    const constraints = {
      to: "LAX",
      depart: "2026-03-01",
      return: "2026-03-10",
    };
    const hotels = await amadeus.searchHotels(constraints);
    expect(Array.isArray(hotels)).toBe(true);
    expect(hotels.length).toBeGreaterThan(0);
    expect(hotels[0]).toHaveProperty("name");
    expect(hotels[0]).toHaveProperty("city");
    expect(hotels[0]).toHaveProperty("price");
    expect(hotels[0]).toHaveProperty("bookingLink");
  });
});
