import burger from './burger.png';
import chickenLeg from './chicken-leg.png';
import pizza from './pizza.png';
import softDrink from './soft-drink.png';
import iceCream from './ice-cream.png';
import delivery from './delivery.png';
import courierMotorbike from './courier-motorbike.png';
import courierCar from './courier-car.webp';
import courierVan from './courier-van.webp';

/** Category id → image asset */
export const CATEGORY_ICON_SRC = {
  fast_food: burger,
  restaurant: chickenLeg,
  drinks: softDrink,
  desserts: iceCream,
  bakery: pizza,
};

/** Courier vehicle id → image asset */
export const COURIER_VEHICLE_ICON_SRC = {
  motorbike: courierMotorbike,
  car: courierCar,
  van: courierVan,
};

export {
  burger,
  chickenLeg,
  pizza,
  softDrink,
  iceCream,
  delivery,
  courierMotorbike,
  courierCar,
  courierVan,
};
