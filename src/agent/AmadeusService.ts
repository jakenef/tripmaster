import logger from "../logger";
import { env } from "../env";
import axios from "axios";
import { TripConstraints, FlightOffer, HotelOffer } from "./TripState";

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

async function getAccessToken() {
  const res = await axios.post(
    `${AMADEUS_BASE_URL}/v1/security/oauth2/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.AMADEUS_CLIENT_ID,
      client_secret: env.AMADEUS_CLIENT_SECRET,
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  const data = res.data as any;
  return data.access_token;
}

export class AmadeusService {
  async getLocationCode(keyword: string): Promise<string | null> {
    if (!keyword) return null;
    // If it looks like an IATA code, return it directly
    if (/^[A-Z]{3}$/.test(keyword.toUpperCase())) return keyword.toUpperCase();

    // No logging
    try {
      const token = await getAccessToken();
      const res = await axios.get(
        `${AMADEUS_BASE_URL}/v1/reference-data/locations`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            subType: "CITY,AIRPORT",
            keyword: keyword.toUpperCase(),
            "page[limit]": 1,
          },
        },
      );
      const data = res.data as any;
      if (data.data && data.data.length > 0) {
        return data.data[0].iataCode;
      }
      return null;
    } catch (err: any) {
      // No logging
      return null;
    }
  }

  async searchFlights(
    constraints: TripConstraints,
  ): Promise<Omit<FlightOffer, "status">[]> {
    // No logging
    try {
      const token = await getAccessToken();
      // Validate date format YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const departDate =
        constraints.depart && dateRegex.test(constraints.depart)
          ? constraints.depart
          : "2026-03-01";
      const params = {
        originLocationCode: constraints.from || "JFK",
        destinationLocationCode: constraints.to || "LAX",
        departureDate: departDate,
        adults: constraints.travelers || 1,
        max: 5,
      };
      const res = await axios.get(
        `${AMADEUS_BASE_URL}/v2/shopping/flight-offers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.amadeus+json",
          },
          params,
        },
      );
      const data = res.data as any;
      if (!data.data || !data.data.length) {
        return [];
      }
      return data.data.map((offer: any, i: number) => {
        const itinerary = offer.itineraries[0];
        const segment = itinerary.segments[0];
        const lastSegment = itinerary.segments[itinerary.segments.length - 1];
        return {
          id: offer.id || `flight${i + 1}`,
          from: segment.departure.iataCode,
          to: lastSegment.arrival.iataCode,
          depart: segment.departure.at,
          arrive: lastSegment.arrival.at,
          airline: segment.carrierCode,
          flightNumber: `${segment.carrierCode}${segment.number}`,
          duration: itinerary.duration,
          stops: itinerary.segments.length - 1,
          price: offer.price.total,
          bookingLink: `https://www.google.com/travel/flights?q=Flights+from+${segment.departure.iataCode}+to+${lastSegment.arrival.iataCode}+on+${segment.departure.at.split("T")[0]}`,
        };
      });
    } catch (err: any) {
      return [];
    }
  }

  async searchHotels(constraints: TripConstraints): Promise<HotelOffer[]> {
    // No logging
    try {
      const token = await getAccessToken();
      let cityCode = "LAX";
      if (constraints.to && constraints.to.length === 3) {
        cityCode = constraints.to.toUpperCase();
      }
      const hotelsRes = await axios.get(
        `${AMADEUS_BASE_URL}/v1/reference-data/locations/hotels/by-city`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.amadeus+json",
          },
          params: { cityCode },
        },
      );
      const hotelsData = hotelsRes.data as any;
      const hotelIds = (hotelsData.data || [])
        .slice(0, 5)
        .map((h: any) => h.hotelId);
      if (!hotelIds.length) {
        return [];
      }
      const offersRes = await axios.get(
        `${AMADEUS_BASE_URL}/v3/shopping/hotel-offers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.amadeus+json",
          },
          params: {
            hotelIds: hotelIds.join(","),
            adults: constraints.travelers || 1,
            checkInDate:
              constraints.depart &&
              /^\d{4}-\d{2}-\d{2}$/.test(constraints.depart)
                ? constraints.depart
                : "2026-03-01",
            checkOutDate:
              constraints.return &&
              /^\d{4}-\d{2}-\d{2}$/.test(constraints.return)
                ? constraints.return
                : "2026-03-10",
            roomQuantity: 1,
            currency: "USD",
          },
        },
      );
      const offersData = offersRes.data as any;
      if (!offersData.data || !offersData.data.length) {
        return [];
      }
      return offersData.data.map((hotel: any, i: number) => {
        const offer = hotel.offers?.[0];
        return {
          id: hotel.hotel?.hotelId || `hotel${i + 1}`,
          name: hotel.hotel?.name,
          city: hotel.hotel?.cityCode,
          checkin: offer?.checkInDate,
          checkout: offer?.checkOutDate,
          price: offer?.price?.total,
          bookingLink: `https://www.google.com/search?q=${encodeURIComponent(hotel.hotel?.name)}+${hotel.hotel?.cityCode}+hotel&checkin=${offer?.checkInDate}&checkout=${offer?.checkOutDate}`,
        };
      });
    } catch (err: any) {
      // No logging
      return [];
    }
  }
}
