/**
 * 国土地理院 ジオコーディング API を利用して住所から座標を取得する
 * @param address 住所文字列
 * @returns { lat: number, lng: number } | null
 */
export async function fetchCoordinatesFromAddress(address: string): Promise<{ lat: number, lng: number } | null> {
    if (!address || address.trim() === '') return null;

    try {
        const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            const firstResult = data[0];
            if (firstResult.geometry && firstResult.geometry.coordinates) {
                // GSI API returns [longitude, latitude]
                const [lng, lat] = firstResult.geometry.coordinates;
                return { lat, lng };
            }
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}
