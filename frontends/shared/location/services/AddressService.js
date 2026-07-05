export function createAddressService(locationApi) {
  return {
    list: () => locationApi.listAddresses(),
    getDefault: () => locationApi.getDefaultAddress(),
    create: (data) => locationApi.createAddress(data),
    update: (id, data) => locationApi.updateAddress(id, data),
    remove: (id) => locationApi.deleteAddress(id),
    setDefault: (id) => locationApi.setDefaultAddress(id),
    saveCurrentLocation: (lat, lng, data) => locationApi.saveCurrentLocation(lat, lng, data),
  };
}
