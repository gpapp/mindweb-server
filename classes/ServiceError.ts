export default class ServiceError extends Error {
    public statusCode:number;
    public message:string;

    constructor(statusCode:number,
                message:string,
                name:string) {
        super();
        this.statusCode = statusCode;
        this.message = message;
        this.name = name;
    }
}
