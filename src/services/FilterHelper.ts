import File from "mindweb-request-classes/dist/classes/File";


export function uniqueFilter(value:string, index:number, array:string[]):boolean {
    return array.indexOf(value) === index;
}

export function uniqueFilterIgnoreCase(value:string, index:number, array:string[]):boolean {
    for (var i = 0; i < index; i++) {
        if (array[i].toLowerCase() === value.toLowerCase()) {
            return false;
        }
    }
    return true;
}

export function exceptFilter(toFilter:string[]) {
    return function (value:string, index:number, array:string[]):boolean {
        return toFilter.indexOf(value) == -1;
    }
}

export function queryFilter(query:string):(value:string, index:number, array:any[])=>boolean {
    var rex:RegExp;
    rex = new RegExp('.*' + query.toLowerCase() + '.*');
    return function (value:string, index:number, array:any[]):boolean {
        if (value == null) return false;
        return rex.test(value.toLowerCase());
    }
}

export function uniqueFilterFile(value:File, index:number, array:File[]):boolean {
    for (var i = 0; i < index; i++) {
        if (array[i].id.toString() === value.id.toString()) {
            return false;
        }
    }
    return true;
}

export function queryFilterFile(query:string):(value:File, index:number, array:File[])=>boolean {
    var rex:RegExp;
    rex = new RegExp('.*' + query.toLowerCase() + '.*');
    return function (value:File, index:number, array:File[]):boolean {
        if (value == null) return false;
        return rex.test(value.name.toLowerCase());
    }
}