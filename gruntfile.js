module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.initConfig({
        clean: {
            gen: {
                expand: true,
                cwd: '.',
                src: ['dest/**']
            },
        },
        ts: {
            default: {
                src: ['src/**/*.ts'],
                dest: 'dest',
                options: {
                    module: 'commonjs', //or commonjs
                    target: 'es6', //or es3
                    sourceMap: true,
                    declaration: false
                }
            },
        },
        mochaTest: {
            default: {
                options: {

                },
                src: ['dest/**/*Test.js']
            }
        }
    });
    grunt.registerTask('default', ['clean', 'ts']);
    grunt.registerTask('dev', ['clean', 'ts', 'mochaTest']);
}
