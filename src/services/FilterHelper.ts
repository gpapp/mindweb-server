import {MapContainer} from "mindweb-request-classes";


export function uniqueFilter(value: string, index: number, array: string[]): boolean {
    return array.indexOf(value) === index;
}

export function uniqueFilterIgnoreCase(value: string, index: number, array: string[]): boolean {
    for (let i = 0; i < index; i++) {
        if (array[i].toLowerCase() === value.toLowerCase()) {
            return false;
        }
    }
    return true;
}

export function exceptFilter(toFilter: string[]) {
    return function (value: string, index: number, array: string[]): boolean {
        return toFilter.indexOf(value) == -1;
    }
}

export function queryFilter(query: string): (value: string, index: number, array: any[]) => boolean {
    const rex: RegExp = new RegExp('.*' + query.toLowerCase() + '.*');
    return function (value: string, index: number, array: any[]): boolean {
        if (value == null) return false;
        return rex.test(value.toLowerCase());
    }
}

export function uniqueFilterMap(value: MapContainer, index: number, array: MapContainer[]): boolean {
    for (let i = 0; i < index; i++) {
        if (array[i].id.toString() === value.id.toString()) {
            return false;
        }
    }
    return true;
}

export function queryFilterMap(query: string): (value: MapContainer, index: number, array: MapContainer[]) => boolean {
    const rex: RegExp = new RegExp('.*' + query.toLowerCase() + '.*');
    return function (value: MapContainer, index: number, array: MapContainer[]): boolean {
        if (value == null) return false;
        return rex.test(value.name.toLowerCase());
    }
}